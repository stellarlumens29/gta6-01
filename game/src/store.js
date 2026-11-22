// store.js — saving: autosave after every completed job, manual save
// from pause (S), Continue on the title screen. One localStorage key,
// plain JSON, no network.

export const SAVE_KEY = 'velmara-save-v1';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

export function saveGame(G) {
  try {
    const data = {
      v: 1,
      cash: G.cash,
      debt: G.debt,
      jobIndex: G.jobIndex,
      jobDone: G.jobDone,
      goldTaken: G.world.goldSpots.map((g) => g.taken),
      stats: G.stats,
      player: {
        x: G.player.x,
        y: G.player.y,
        angle: G.player.angle,
        hp: G.player.hp,
        armor: G.player.armor,
        ammo: G.player.ammo,
        reserve: G.player.reserve,
      },
      clockMin: G.clockMin,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {}
}

// Apply a loaded save onto a fresh game state.
export function applySave(G, data) {
  G.cash = data.cash;
  G.debt = data.debt;
  G.jobIndex = data.jobIndex;
  G.jobDone = data.jobDone.slice();
  (data.goldTaken || []).forEach((taken, i) => {
    if (G.world.goldSpots[i]) G.world.goldSpots[i].taken = !!taken;
  });
  Object.assign(G.stats, data.stats || {});
  Object.assign(G.player, data.player);
  G.clockMin = data.clockMin || G.clockMin;
  G.player.vehicle = null;
  G.player.onFoot = true;
}
