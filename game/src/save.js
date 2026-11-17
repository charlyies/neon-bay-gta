// NEON BAY — localStorage save: cash, mission progress, position.
// Written fresh for the make.fun gta6-01 entry.
const KEY = 'neonbay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.mission !== 'number') return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({
      cash: state.cash,
      mission: state.mission,
      px: state.px,
      pz: state.pz,
      health: state.health,
      savedAt: Date.now(),
    }));
    return true;
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* private mode */ }
}
