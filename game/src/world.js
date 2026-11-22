// world.js — Velmara itself: the canal city, its districts, roads,
// buildings, beach, marina, signs, parked cars, gold and shops.
// buildWorld(seed) is pure data: no canvas, no DOM, fully deterministic.

import { makeRng, clamp } from './rng.js';

export const WORLD_W = 2880;
export const WORLD_H = 2160;

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1180, h: 980, tint: '#e8b06a' },
  { name: 'Canal Row', x: 1180, y: 0, w: 860, h: 980, tint: '#e09a55' },
  { name: 'Neon Strip', x: 2040, y: 0, w: 840, h: 980, tint: '#d97f8f' },
  { name: 'Hillcrest', x: 0, y: 1180, w: 1180, h: 500, tint: '#c98d5f' },
  { name: 'Marina', x: 1180, y: 1180, w: 860, h: 500, tint: '#7fb3c8' },
  { name: 'Portside', x: 2040, y: 1180, w: 840, h: 500, tint: '#b98a6a' },
  { name: 'Beachfront', x: 0, y: 1680, w: 2880, h: 480, tint: '#eec27f' },
];

export const NEON_SIGNS = [
  { text: 'HOTEL LUNA', x: 1330, y: 300, color: '#ff5da2' },
  { text: 'BAR NEON', x: 2150, y: 620, color: '#39d0ff' },
  { text: 'CASINO SOL', x: 2450, y: 260, color: '#ffd23e' },
  { text: 'CLUB MAREA', x: 1500, y: 1420, color: '#b678ff' },
  { text: 'TACOS 24H', x: 620, y: 1450, color: '#ff8a3c' },
  { text: 'CINE ORO', x: 420, y: 760, color: '#ffe9a8' },
];

export const VEHICLE_TYPES = [
  { name: 'Veloce GT', color: '#f5c518', top: 265, accel: 150, grip: 2.9 },
  { name: 'Solmar Coupe', color: '#d94f3d', top: 235, accel: 135, grip: 2.7 },
  { name: 'Canal Taxi', color: '#f2b705', top: 200, accel: 115, grip: 2.6 },
  { name: 'Marea Sedan', color: '#3d7ea6', top: 210, accel: 120, grip: 2.6 },
  { name: 'Port Van', color: '#8a8f98', top: 175, accel: 95, grip: 2.3 },
  { name: 'Dune Buggy', color: '#e07b39', top: 190, accel: 125, grip: 2.4 },
  { name: 'VPD Interceptor', color: '#1c2733', top: 250, accel: 160, grip: 3.1 },
];

function rectsOverlap(a, b, pad) {
  return (
    a.x - pad < b.x + b.w &&
    a.x + a.w + pad > b.x &&
    a.y - pad < b.y + b.h &&
    a.y + a.h + pad > b.y
  );
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const W = WORLD_W;
  const H = WORLD_H;

  // Road grid. Vertical roads run the full height except where the canal
  // cuts them; only the two bridge roads cross the water.
  const roadsX = [220, 560, 900, 1240, 1580, 1920, 2260, 2600];
  const roadsY = [200, 540, 860, 1360, 1620, 1900];
  const canal = { y0: 1000, y1: 1160, bridges: [900, 1920] };
  const beach = { y0: 1980 };
  const marina = { x: 1500, y: 1240, w: 420, h: 260 };

  const plaza = { x: 980, y: 620, w: 260, h: 200 };
  const parks = [
    { x: 240, y: 1380, w: 300, h: 220 },
    { x: 2300, y: 1380, w: 280, h: 200 },
  ];

  // 62 extruded buildings, seeded into the blocks between roads.
  const buildings = [];
  const blocked = [
    { x: 0, y: canal.y0 - 20, w: W, h: canal.y1 - canal.y0 + 40 },
    { x: 0, y: beach.y0 - 10, w: W, h: H - beach.y0 + 10 },
    marina,
    plaza,
    ...parks,
  ];
  let guard = 0;
  while (buildings.length < 62 && guard++ < 20000) {
    const w = rng.int(90, 190);
    const d = rng.int(80, 160);
    const x = rng.int(40, W - w - 40);
    const y = rng.int(40, H - d - 40);
    const box = { x, y, w, h: d };
    if (blocked.some((b) => rectsOverlap(box, b, 14))) continue;
    // Keep off the road corridors (roads are 64 wide, centred on the lines).
    if (roadsX.some((rx) => x < rx + 36 && x + w > rx - 36)) continue;
    if (roadsY.some((ry) => y < ry + 36 && y + d > ry - 36)) continue;
    if (buildings.some((b) => rectsOverlap(box, b, 12))) continue;
    const hue = rng.pick([38, 28, 18, 200, 150, 330]);
    buildings.push({
      x,
      y,
      w,
      d,
      h: rng.int(46, 150),
      hue,
      lit: rng.next(),
      sign: rng.chance(0.12) ? rng.pick(['HOTEL', 'BAR', 'SHOP', 'CAFE']) : null,
    });
  }

  // Palms: beach fringe, plaza ring and park edges.
  const palms = [];
  for (let i = 0; i < 46; i++) {
    palms.push({
      x: rng.int(60, W - 60),
      y: rng.int(beach.y0 + 30, H - 40),
      lean: rng.range(-0.25, 0.25),
      s: rng.range(0.8, 1.25),
    });
  }
  for (let i = 0; i < 18; i++) {
    palms.push({
      x: rng.int(plaza.x - 40, plaza.x + plaza.w + 40),
      y: rng.int(plaza.y - 30, plaza.y + plaza.h + 30),
      lean: rng.range(-0.2, 0.2),
      s: rng.range(0.85, 1.15),
    });
  }

  // Parked cars along road edges, clear of intersections and the canal.
  const parked = [];
  guard = 0;
  while (parked.length < 16 && guard++ < 2000) {
    const horizontal = rng.chance(0.5);
    let x;
    let y;
    let angle;
    if (horizontal) {
      const ry = rng.pick(roadsY);
      x = rng.int(80, W - 80);
      y = ry + rng.pick([-52, 52]);
      angle = rng.chance(0.5) ? 0 : Math.PI;
    } else {
      const rx = rng.pick(roadsX);
      x = rx + rng.pick([-52, 52]);
      y = rng.int(80, H - 80);
      angle = rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
    }
    if (y > canal.y0 - 70 && y < canal.y1 + 70) continue;
    if (y > beach.y0 - 60) continue;
    if (parked.some((p) => Math.hypot(p.x - x, p.y - y) < 120)) continue;
    if (buildings.some((b) => rectsOverlap({ x: x - 30, y: y - 30, w: 60, h: 60 }, b, 8))) continue;
    parked.push({ x, y, angle, type: rng.int(0, 5), taken: false });
  }
  // The yellow Veloce GT — the Hot Wheels target — waits on the Strip.
  parked[0] = { x: 2380, y: 808, angle: 0, type: 0, taken: false, target: true };

  // 12 hidden gold bars, tucked behind buildings and around the map.
  const goldSpots = [];
  guard = 0;
  while (goldSpots.length < 12 && guard++ < 3000) {
    const x = rng.int(90, W - 90);
    const y = rng.int(90, H - 90);
    if (y > canal.y0 - 40 && y < canal.y1 + 40) continue;
    if (y > beach.y0 - 30) continue;
    if (goldSpots.some((g) => Math.hypot(g.x - x, g.y - y) < 260)) continue;
    goldSpots.push({ x, y, taken: false });
  }

  const shops = [
    { name: "Marty's Guns & Meds", kind: 'guns', x: 700, y: 480 },
    { name: 'Rosa Auto Repair', kind: 'repair', x: 2100, y: 1520 },
  ];

  return {
    W,
    H,
    seed,
    districts: DISTRICTS,
    roadsX,
    roadsY,
    canal,
    beach,
    marina,
    plaza,
    parks,
    buildings,
    palms,
    parked,
    goldSpots,
    shops,
    signs: NEON_SIGNS,
    vault: { x: 1120, y: 300 },
    docks: { x: 2560, y: 1300 },
    yacht: { x: 1720, y: 1380 },
    spawn: { x: 1080, y: 760 },
  };
}

// Which district contains a point (for the HUD location line).
export function districtAt(world, x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Velmara';
}

// Is this point in water (canal, marina basin or the sea past the beach)?
export function inWater(world, x, y) {
  if (y >= world.canal.y0 && y <= world.canal.y1) {
    return !world.canal.bridges.some((bx) => Math.abs(x - bx) < 46);
  }
  if (y >= world.beach.y0 + 90) return true;
  const m = world.marina;
  return x >= m.x && x <= m.x + m.w && y >= m.y && y <= m.y + m.h;
}

// Nearest road line to a point, for traffic and police routing.
export function nearestRoad(world, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of world.roadsX) {
    const d = Math.abs(x - rx);
    if (d < bestD) {
      bestD = d;
      best = { axis: 'x', at: rx };
    }
  }
  for (const ry of world.roadsY) {
    const d = Math.abs(y - ry);
    if (d < bestD) {
      bestD = d;
      best = { axis: 'y', at: ry };
    }
  }
  return best;
}

export function clampToWorld(world, p, r) {
  p.x = clamp(p.x, r, world.W - r);
  p.y = clamp(p.y, r, world.H - r);
}
