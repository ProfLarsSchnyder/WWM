import { resolveSupabaseConfig } from './config-v3.js';

const TEACHER_TOKEN_KEY = 'wwm_v3_teacher_token';
const STUDENT_SESSION_KEY = 'wwm_v3_student_session';

function config() {
  const value = resolveSupabaseConfig();
  if (!value.url || !value.key) {
    throw new Error('SERVER_NOT_CONFIGURED');
  }
  return value;
}

export function isBackendConfigured() {
  const value = resolveSupabaseConfig();
  return Boolean(value.url && value.key);
}

export async function rpc(name, body = {}) {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; }
  catch { payload = text; }

  if (!response.ok) {
    const message = payload?.message || payload?.details || payload?.hint || text || `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function teacherToken() {
  return sessionStorage.getItem(TEACHER_TOKEN_KEY) || '';
}

export function setTeacherToken(token) {
  if (token) sessionStorage.setItem(TEACHER_TOKEN_KEY, token);
  else sessionStorage.removeItem(TEACHER_TOKEN_KEY);
}

export async function teacherLogin(pin) {
  const result = await rpc('wwm_teacher_login', { p_pin: String(pin || '') });
  setTeacherToken(result?.token || '');
  return result;
}

export async function teacherLogout() {
  const token = teacherToken();
  try {
    if (token) await rpc('wwm_teacher_logout', { p_token: token });
  } finally {
    setTeacherToken('');
  }
}

function teacherRpc(name, body = {}) {
  const token = teacherToken();
  if (!token) throw new Error('TEACHER_LOGIN_REQUIRED');
  return rpc(name, { p_token: token, ...body });
}

export const teacherGetSettings = () => teacherRpc('wwm_teacher_get_settings');
export const teacherGamesList = () => teacherRpc('wwm_teacher_games_list');
export const teacherGameSave = game => teacherRpc('wwm_teacher_game_save', { p_game: game });
export const teacherGameDelete = gameId => teacherRpc('wwm_teacher_game_delete', { p_game_id: gameId });
export const teacherHostGame = gameId => teacherRpc('wwm_teacher_host_game', { p_game_id: gameId });
export const teacherStopHost = () => teacherRpc('wwm_teacher_stop_host');
export const teacherDashboard = () => teacherRpc('wwm_teacher_dashboard');
export const teacherDashboardGame = gameId => teacherRpc('wwm_teacher_dashboard_game', { p_game_id: gameId });
export const teacherResetAnalysis = gameId => teacherRpc('wwm_teacher_reset_analysis', { p_game_id: gameId });
export const teacherSessionHistory = () => teacherRpc('wwm_teacher_session_history');

export function studentSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STUDENT_SESSION_KEY) || 'null');
    return parsed && parsed.participantId && parsed.participantToken ? parsed : null;
  } catch {
    return null;
  }
}

export function setStudentSession(value) {
  if (value) localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(STUDENT_SESSION_KEY);
}

export async function studentPreview(joinCode) {
  return rpc('wwm_student_preview', { p_join_code: String(joinCode || '').trim() });
}

export async function studentJoin(joinCode, name, className) {
  const result = await rpc('wwm_student_join', {
    p_join_code: String(joinCode || '').trim(),
    p_student_name: String(name || '').trim(),
    p_class_name: String(className || '').trim()
  });
  const session = {
    participantId: result.participantId,
    participantToken: result.participantToken,
    sessionId: result.sessionId,
    gameId: result.gameId,
    title: result.title,
    studentName: result.studentName,
    className: result.className,
    questionCount: result.questionCount,
    currentQuestionIndex: result.currentQuestionIndex || 0
  };
  setStudentSession(session);
  return session;
}

function studentRpc(name, body = {}) {
  const session = studentSession();
  if (!session) throw new Error('STUDENT_SESSION_REQUIRED');
  return rpc(name, {
    p_participant_id: session.participantId,
    p_token: session.participantToken,
    ...body
  });
}

export async function studentResume() {
  const result = await studentRpc('wwm_student_resume');
  const existing = studentSession();
  const merged = {
    ...existing,
    participantId: result.participantId,
    sessionId: result.sessionId,
    gameId: result.gameId,
    title: result.title,
    studentName: result.studentName,
    className: result.className,
    questionCount: result.questionCount,
    currentQuestionIndex: result.currentQuestionIndex,
    status: result.status,
    jokersUsed: result.jokersUsed
  };
  setStudentSession(merged);
  return result;
}

export const studentGetQuestion = index => studentRpc('wwm_student_get_question', { p_question_index: index });
export const studentSubmitAnswer = (index, key, responseMs = null) => studentRpc('wwm_student_submit_answer', {
  p_question_index: index,
  p_selected_key: String(key || '').toUpperCase(),
  p_response_ms: responseMs
});
export const studentUseJoker = type => studentRpc('wwm_student_use_joker', { p_joker_type: type });
export const studentHeartbeat = () => studentRpc('wwm_student_heartbeat');
export const studentQuit = () => studentRpc('wwm_student_quit');

export function clearStudentSession() {
  setStudentSession(null);
}

export function friendlyBackendError(error, { student = false } = {}) {
  const message = String(error?.message || error || 'Unbekannter Fehler');
  if (message === 'SERVER_NOT_CONFIGURED') {
    return student ? 'Das Spiel ist momentan nicht verfügbar.' : 'Supabase ist noch nicht in js/config-v3.js eingerichtet.';
  }
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return student ? 'Die Verbindung zum Spielserver ist fehlgeschlagen.' : 'Supabase ist nicht erreichbar. Prüfe Internetverbindung, Project URL und Publishable Key.';
  }
  if (/falsches passwort/i.test(message)) return 'Passwort ist nicht korrekt.';
  if (/lehrer sitzung|teacher_login_required/i.test(message)) return 'Lehrersitzung ist abgelaufen. Bitte erneut anmelden.';
  if (/code ist nicht gültig/i.test(message)) return 'Der Spielcode ist nicht korrekt.';
  if (/kein spiel geöffnet/i.test(message)) return 'Momentan ist kein Spiel für Lernende geöffnet.';
  if (/spieler sitzung|student_session_required/i.test(message)) return 'Deine Spielsitzung ist nicht mehr verfügbar.';
  return message;
}
