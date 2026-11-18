// NEON BAY round 2 — localStorage save: cash, mission progress, position,
// health and banked neon tokens. One key, one JSON blob, defensive parsing.
// Versioned key: round 2 saves carry a tokens count round 1 saves lack,
// and loadSave tolerates both shapes.
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
      tokens: state.tokens || 0,
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

// Round 3 note: the localStorage save still holds cash, mission progress
// and position, and still clears on a wasted or busted ending.

// Round 3 note, continued: loading a save restores position as well as
// progress, so a returning player picks up where they left off.
