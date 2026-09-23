const LOCAL_KEY = "wwm_school_games_v2";
const CLOUD_KEY = "wwm_school_cloud_v1";

let backend = "local";
let cloudSettings = loadCloudSettings();
let cloudError = null;

export async function initStorage() {
  if (!hasCompleteCloudSettings(cloudSettings)) {
    backend = "local";
    return getStorageStatus();
  }

  try {
    await cloudListGames();
    backend = "cloud";
    cloudError = null;
  } catch (error) {
    console.warn("WWM Cloud konnte nicht verbunden werden.", error);
    backend = "local";
    cloudError = error?.message || "Cloud nicht erreichbar";
  }
  return getStorageStatus();
}

export function getBackend() {
  return backend;
}

export function getStorageStatus() {
  return {
    backend,
    configured: hasCompleteCloudSettings(cloudSettings),
    cloudError,
    url: cloudSettings?.url || "",
    publishableKey: cloudSettings?.publishableKey || "",
    workspaceKey: cloudSettings?.workspaceKey || ""
  };
}

export function generateWorkspaceKey() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  return raw.match(/.{1,6}/g).join("-");
}

export async function configureCloud({ url, publishableKey, workspaceKey }) {
  const next = normalizeCloudSettings({ url, publishableKey, workspaceKey });
  if (!hasCompleteCloudSettings(next)) {
    throw new Error("Bitte Supabase URL, Publishable Key und Cloud Code vollständig eingeben.");
  }
  if (next.workspaceKey.replace(/-/g, "").length < 20) {
    throw new Error("Der Cloud Code ist zu kurz. Nutze am besten den automatisch erzeugten Code.");
  }

  const previous = cloudSettings;
  cloudSettings = next;
  try {
    await cloudListGames();
    localStorage.setItem(CLOUD_KEY, JSON.stringify(next));
    backend = "cloud";
    cloudError = null;
    return getStorageStatus();
  } catch (error) {
    cloudSettings = previous;
    backend = hasCompleteCloudSettings(previous) ? backend : "local";
    throw new Error(`Cloud Verbindung fehlgeschlagen: ${friendlyCloudError(error)}`);
  }
}

export function disconnectCloud() {
  localStorage.removeItem(CLOUD_KEY);
  cloudSettings = null;
  cloudError = null;
  backend = "local";
  return getStorageStatus();
}

export async function migrateLocalGamesToCloud() {
  if (backend !== "cloud") throw new Error("Zuerst die Cloud verbinden.");
  const games = loadLocalGames();
  for (const game of games) await cloudSaveGame(game);
  return games.length;
}

export async function listGames() {
  if (backend === "cloud") return cloudListGames();
  return loadLocalGames().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getGame(id) {
  const games = await listGames();
  return games.find(game => game.id === id) ?? null;
}

export async function saveGame(game) {
  const normalized = normalizeGame(game);
  if (backend === "cloud") return cloudSaveGame(normalized);

  const games = loadLocalGames();
  const index = games.findIndex(item => item.id === normalized.id);
  if (index >= 0) games[index] = normalized;
  else games.push(normalized);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
  return normalized;
}

export async function deleteGame(id) {
  if (backend === "cloud") return cloudDeleteGame(id);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(loadLocalGames().filter(game => game.id !== id)));
}

export async function duplicateGame(id) {
  const game = await getGame(id);
  if (!game) throw new Error("Spiel nicht gefunden.");
  return saveGame({
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    questions: game.questions.map(question => ({ ...question, id: crypto.randomUUID() }))
  });
}

function normalizeGame(game) {
  return {
    ...game,
    id: game.id || crypto.randomUUID(),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function loadLocalGames() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadCloudSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLOUD_KEY) || "null");
    return parsed ? normalizeCloudSettings(parsed) : null;
  } catch {
    return null;
  }
}

function normalizeCloudSettings(settings = {}) {
  return {
    url: String(settings.url || "").trim().replace(/\/+$/, ""),
    publishableKey: String(settings.publishableKey || settings.anonKey || "").trim(),
    workspaceKey: String(settings.workspaceKey || "").trim()
  };
}

function hasCompleteCloudSettings(settings) {
  return Boolean(settings?.url && settings?.publishableKey && settings?.workspaceKey);
}

async function cloudListGames() {
  const rows = await rpc("wwm_games_list", { p_workspace_key: cloudSettings.workspaceKey });
  if (!Array.isArray(rows)) return [];
  return rows.map(fromCloudRow).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function cloudSaveGame(game) {
  const saved = await rpc("wwm_game_save", {
    p_workspace_key: cloudSettings.workspaceKey,
    p_game: {
      id: game.id,
      title: game.title,
      questions: game.questions,
      createdAt: game.createdAt,
      updatedAt: game.updatedAt
    }
  });
  return fromCloudRow(saved);
}

async function cloudDeleteGame(id) {
  await rpc("wwm_game_delete", {
    p_workspace_key: cloudSettings.workspaceKey,
    p_id: id
  });
}

async function rpc(name, body) {
  if (!hasCompleteCloudSettings(cloudSettings)) throw new Error("Cloud ist nicht eingerichtet.");
  const response = await fetch(`${cloudSettings.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: cloudSettings.publishableKey,
      Authorization: `Bearer ${cloudSettings.publishableKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const message = payload?.message || payload?.hint || payload?.details || text || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function fromCloudRow(row) {
  if (!row || typeof row !== "object") return row;
  return {
    id: row.id,
    title: row.title,
    questions: Array.isArray(row.questions) ? row.questions : [],
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

function friendlyCloudError(error) {
  const message = String(error?.message || error || "Unbekannter Fehler");
  if (/function .* does not exist|could not find the function/i.test(message)) {
    return "Die WWM Datenbankfunktionen fehlen. Bitte zuerst supabase/schema.sql im Supabase SQL Editor ausführen.";
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return "Supabase ist nicht erreichbar. Prüfe URL, Internetverbindung und Browserfreigaben.";
  }
  if (/invalid api key|jwt|apikey/i.test(message)) {
    return "Der Publishable Key scheint nicht zu stimmen.";
  }
  return message;
}
