const LOCAL_KEY = "wwm_school_games_v2";

export async function initStorage() {
  return { backend: "local" };
}

export function getBackend() {
  return "local";
}

export async function listGames() {
  return loadLocalGames().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getGame(id) {
  return loadLocalGames().find(game => game.id === id) ?? null;
}

export async function saveGame(game) {
  const normalized = {
    ...game,
    id: game.id || crypto.randomUUID(),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const games = loadLocalGames();
  const index = games.findIndex(item => item.id === normalized.id);
  if (index >= 0) games[index] = normalized;
  else games.push(normalized);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
  return normalized;
}

export async function deleteGame(id) {
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

function loadLocalGames() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
