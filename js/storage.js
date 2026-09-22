import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const LOCAL_KEY = "wwm_school_games_v1";
let supabaseClient = null;
let backend = "local";

export async function initStorage() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    backend = "local";
    return { backend };
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { error } = await supabaseClient.from("games").select("id").limit(1);
    if (error) throw error;
    backend = "supabase";
  } catch (error) {
    console.warn("Supabase nicht verfügbar, lokale Speicherung wird verwendet.", error);
    backend = "local";
  }

  return { backend };
}

export function getBackend() {
  return backend;
}

export async function listGames() {
  if (backend === "supabase" && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("games")
      .select("id,title,created_at,updated_at,questions(id,position,question,correct_answer,wrong_answers)")
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(mapSupabaseGame);
  }

  return loadLocalGames().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getGame(id) {
  if (backend === "supabase" && supabaseClient) {
    const { data, error } = await supabaseClient
      .from("games")
      .select("id,title,created_at,updated_at,questions(id,position,question,correct_answer,wrong_answers)")
      .eq("id", id)
      .single();

    if (error) throw error;
    return mapSupabaseGame(data);
  }

  return loadLocalGames().find(game => game.id === id) ?? null;
}

export async function saveGame(game) {
  const normalized = {
    ...game,
    id: game.id || crypto.randomUUID(),
    createdAt: game.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (backend === "supabase" && supabaseClient) {
    const { data: savedGame, error: gameError } = await supabaseClient
      .from("games")
      .upsert({
        id: normalized.id,
        title: normalized.title,
        created_at: normalized.createdAt,
        updated_at: normalized.updatedAt
      })
      .select("id,title,created_at,updated_at")
      .single();

    if (gameError) throw gameError;

    const { error: deleteError } = await supabaseClient
      .from("questions")
      .delete()
      .eq("game_id", normalized.id);
    if (deleteError) throw deleteError;

    const rows = normalized.questions.map((question, position) => ({
      id: question.id || crypto.randomUUID(),
      game_id: normalized.id,
      position,
      question: question.question,
      correct_answer: question.correct,
      wrong_answers: question.wrong
    }));

    if (rows.length) {
      const { error: questionError } = await supabaseClient.from("questions").insert(rows);
      if (questionError) throw questionError;
    }

    return {
      ...normalized,
      id: savedGame.id,
      createdAt: savedGame.created_at,
      updatedAt: savedGame.updated_at
    };
  }

  const games = loadLocalGames();
  const index = games.findIndex(item => item.id === normalized.id);
  if (index >= 0) games[index] = normalized;
  else games.push(normalized);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
  return normalized;
}

export async function deleteGame(id) {
  if (backend === "supabase" && supabaseClient) {
    const { error } = await supabaseClient.from("games").delete().eq("id", id);
    if (error) throw error;
    return;
  }

  const games = loadLocalGames().filter(game => game.id !== id);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(games));
}

export async function duplicateGame(id) {
  const game = await getGame(id);
  if (!game) throw new Error("Spiel nicht gefunden.");

  return saveGame({
    id: crypto.randomUUID(),
    title: `${game.title} Kopie`,
    questions: game.questions.map(question => ({
      ...question,
      id: crypto.randomUUID()
    }))
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

function mapSupabaseGame(row) {
  const questions = [...(row.questions ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(item => ({
      id: item.id,
      question: item.question,
      correct: item.correct_answer,
      wrong: Array.isArray(item.wrong_answers) ? item.wrong_answers : []
    }));

  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions
  };
}
