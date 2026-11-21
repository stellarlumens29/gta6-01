// VELMARA — city.js: the city of Velmara, a sun-soaked canal city at
// golden hour. Original map, names, districts and art — nothing from any
// commercial game. Grid roads, extruded 2.5D buildings, a canal with two
// bridges, a marina, a beach strip and a neon strip. Deterministic from seed.
import { mulberry32, randRange, randInt, pick, clamp } from './util.js';

export const WORLD_W = 2880;
export const WORLD_H = 2160;
export const ROAD = 360;      // block pitch
export const ROAD_W = 72;     // road width
export const COLS = 8;        // intersections across (0..7)
export const ROWS = 6;        // intersections down (0..5)

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1080, h: 720, tint: '#e8b04b' },
  { name: 'Canal Row', x: 1080, y: 0, w: 720, h: 720, tint: '#4fb3c9' },
  { name: 'Neon Strip', x: 1800, y: 0, w: 1080, h: 720, tint: '#ff5da2' },
  { name: 'Hillcrest', x: 0, y: 720, w: 1080, h: 720, tint: '#7fb069' },
  { name: 'Marina', x: 1080, y: 720, w: 720, h: 720, tint: '#3f8fbf' },
  { name: 'Portside', x: 1800, y: 720, w: 1080, h: 720, tint: '#c97b4a' },
  { name: 'Beachfront', x: 0, y: 1440, w: 2880, h: 720, tint: '#f2c14e' },
];

export const PLACES = {
  // All markers sit on road centre-lines so the player and cars can reach them.
  safehouse: { x: 180, y: 36, label: 'Safehouse — Casa Alba' },
  gunshop: { x: 540, y: 396, label: "Marty's Guns & Meds" },
  repair: { x: 2340, y: 396, label: 'Rosa Auto Repair' },
  bank: { x: 1836, y: 396, label: 'Velmara Reserve Bank' },
  marina: { x: 1476, y: 1116, label: 'Marina — The Albatross' },
  port: { x: 2556, y: 1116, label: 'Portside Docks' },
  hospital: { x: 36, y: 1116, label: 'St. Alba Hospital' },
  police: { x: 2556, y: 36, label: 'Velmara PD HQ' },
  docks: { x: 2556, y: 1260, label: 'Container Yard' },
  plaza: { x: 900, y: 396, label: 'Plaza del Sol' },
};

const BUILDING_PALETTES = [
  ['#f2c14e', '#e8a33d', '#d98e2b'], // warm stucco
  ['#e07856', '#c95f43', '#a84a33'], // terracotta
  ['#7fb069', '#5f9150', '#4a7340'], // green
  ['#4fb3c9', '#3a90a8', '#2c7285'], // canal blue
  ['#ff8fab', '#e56b8c', '#b84a6e'], // neon pink
  ['#f7ede2', '#e5d3bd', '#cbb294'], // pale stone
  ['#8d6fb8', '#6f5496', '#543d75'], // violet
  ['#5b8def', '#4068c4', '#2f4e96'], // marina blue
];

export function buildCity(seed) {
  const rng = mulberry32(seed);
  // Clear zones: the spawn point and the fixed cash-stash points must never
  // sit inside a building, or the player / a mission step gets stuck.
  const CLEAR = [
    { x: 180, y: 220, r: 110 },
    { x: 200, y: 200, r: 55 }, { x: 900, y: 120, r: 55 }, { x: 500, y: 560, r: 55 },
    { x: 150, y: 620, r: 55 }, { x: 950, y: 620, r: 55 },
  ];
  const clearOf = (x, y, w, h) => !CLEAR.some((z) => x < z.x + z.r && x + w > z.x - z.r && y < z.y + z.r && y + h > z.y - z.r);
  const buildings = [];
  const colliders = [];
  const palms = [];
  const neonSigns = [];
  const parks = [];
  // Canal: vertical water band between Canal Row and Neon Strip (x 1800..1872 is a road;
  // canal runs along x = 1692..1764, crossing rows 0..1, with bridges on roads y=360, y=720).
  const canal = { x: 1692, y: 0, w: 72, h: 720 };
  // Beach: south strip y 1980..2160 is sand + sea; no buildings there.
  for (let c = 0; c < COLS - 1; c += 1) {
    for (let r = 0; r < ROWS - 1; r += 1) {
      const bx = c * ROAD + ROAD_W + 14;
      const by = r * ROAD + ROAD_W + 14;
      const bw = ROAD - ROAD_W - 28;
      const bh = ROAD - ROAD_W - 28;
      // Canal block: skip buildings, it is water.
      if (bx + bw > canal.x && bx < canal.x + canal.w && by < canal.h) continue;
      // Beachfront row: plaza / palms, no buildings.
      if (r === ROWS - 2) {
        if (rng() < 0.55) parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let p = 0; p < 5; p += 1) {
          palms.push({ x: bx + randRange(rng, 20, bw - 20), y: by + randRange(rng, 20, bh - 20) });
        }
        continue;
      }
      // Plaza del Sol block stays open.
      if (c === 2 && r === 1) {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let p = 0; p < 4; p += 1) palms.push({ x: bx + randRange(rng, 20, bw - 20), y: by + randRange(rng, 20, bh - 20) });
        continue;
      }
      const n = randInt(rng, 2, 4);
      for (let i = 0; i < n; i += 1) {
        const w = randRange(rng, 60, 120);
        const h = randRange(rng, 60, 120);
        const x = bx + randRange(rng, 0, Math.max(1, bw - w));
        const y = by + randRange(rng, 0, Math.max(1, bh - h));
        const height = randInt(rng, 26, 96);
        const pal = pick(rng, BUILDING_PALETTES);
        if (!clearOf(x, y, w, h)) continue;
        const b = { x, y, w, h, height, roof: pal[0], wall: pal[1], shade: pal[2], floors: Math.max(1, Math.round(height / 22)) };
        buildings.push(b);
        colliders.push({ x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 });
      }
      // Neon signs on the Neon Strip blocks.
      if (c >= 5 && rng() < 0.9) {
        neonSigns.push({ x: bx + bw / 2, y: by + 6, text: pick(rng, ['HOTEL LUNA', 'BAR NEON', 'CASINO SOL', 'CLUB MAREA', 'TACOS 24H', 'CINE ORO']), color: pick(rng, ['#ff5da2', '#3ee6c4', '#ffd23f', '#7cf29c']) });
      }
      if (rng() < 0.4) palms.push({ x: bx + randRange(rng, 10, bw - 10), y: by + randRange(rng, 10, bh - 10) });
    }
  }
  // Marina boats (decor, no collision).
  const boats = [];
  for (let i = 0; i < 6; i += 1) boats.push({ x: 1180 + i * 90, y: 1090 + (i % 2) * 60, angle: randRange(rng, -0.3, 0.3), color: pick(rng, ['#f7ede2', '#ffd23f', '#4fb3c9', '#ff8fab']) });
  return { buildings, colliders, palms, neonSigns, parks, boats, canal, seed };
}

/** Intersection centres: ix in 0..COLS-1, iy in 0..ROWS-1. */
export function intersection(ix, iy) {
  return { x: ix * ROAD + ROAD_W / 2, y: iy * ROAD + ROAD_W / 2 };
}
export function nearestIntersection(x, y) {
  return {
    ix: clamp(Math.round((x - ROAD_W / 2) / ROAD), 0, COLS - 1),
    iy: clamp(Math.round((y - ROAD_W / 2) / ROAD), 0, ROWS - 1),
  };
}
/** Is a point on a road (drivable for traffic / police routing)? */
export function isOnRoad(x, y) {
  const mx = ((x % ROAD) + ROAD) % ROAD;
  const my = ((y % ROAD) + ROAD) % ROAD;
  return mx < ROAD_W || my < ROAD_W;
}
/** Road point clamped inside the world. */
export function clampToWorld(x, y, m) {
  return { x: clamp(x, m, WORLD_W - m), y: clamp(y, m, WORLD_H - m) };
}
export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'Velmara';
}
