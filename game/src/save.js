// VELMARA — save.js: save / load through localStorage. Autosaves after
// every completed job; the title screen offers Continue when a save exists.
const KEY = 'velmara-save-v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}

export function hasSave() {
  try { return localStorage.getItem(KEY) !== null; } catch (e) { return false; }
}
