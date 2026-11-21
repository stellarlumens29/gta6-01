// VELMARA — peds.js: pedestrians on the sidewalks. They stroll, wait at
// corners, chat in pairs, and flee from gunfire. Hitting one is a crime
// (the wanted system notices), so the city feels alive and consequential.
import { clamp, dist, randRange, randInt, pick } from './util.js';
import { ROAD, COLS, ROWS, intersection, WORLD_W, WORLD_H } from './city.js';

const SHIRTS = ['#f2c14e', '#ff8fab', '#4fb3c9', '#7fb069', '#e8e2d5', '#c94f43', '#8d6fb8', '#5b8def'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = randRange(rng, 0, Math.PI * 2);
    this.speed = randRange(rng, 28, 52);
    this.shirt = pick(rng, SHIRTS);
    this.skin = pick(rng, SKINS);
    this.target = null;
    this.wait = randRange(rng, 0, 3);
    this.fleeing = false;
    this.fleeTimer = 0;
    this.radius = 12;
    this.dead = false;
  }
}

export function spawnPeds(rng, count, colliders) {
  const peds = [];
  let guard = 0;
  while (peds.length < count && guard < count * 30) {
    guard += 1;
    const ix = randInt(rng, 0, COLS - 1);
    const iy = randInt(rng, 0, ROWS - 1);
    const p = intersection(ix, iy);
    const x = p.x + randRange(rng, -150, 150);
    const y = p.y + randRange(rng, -150, 150);
    if (x < 30 || y < 30 || x > WORLD_W - 30 || y > WORLD_H - 30) continue;
    let bad = false;
    for (const b of colliders) {
      if (x > b.x - 16 && x < b.x + b.w + 16 && y > b.y - 16 && y < b.y + b.h + 16) { bad = true; break; }
    }
    if (bad) continue;
    peds.push(new Ped(x, y, rng));
  }
  return peds;
}

export function updatePeds(peds, dt, colliders, danger, rng) {
  for (const p of peds) {
    if (p.dead) continue;
    if (danger) {
      const d = dist(p.x, p.y, danger.x, danger.y);
      if (d < 320) { p.fleeing = true; p.fleeTimer = 2.5; }
    }
    if (p.fleeTimer > 0) {
      p.fleeTimer -= dt;
      const a = Math.atan2(p.y - danger.y, p.x - danger.x);
      p.angle = a;
      p.x += Math.cos(a) * 150 * dt;
      p.y += Math.sin(a) * 150 * dt;
      if (p.fleeTimer <= 0) p.fleeing = false;
    } else if (p.wait > 0) {
      p.wait -= dt;
    } else {
      if (!p.target) {
        // Pick a nearby sidewalk point: offset along a road from current spot.
        const horiz = rng() < 0.5;
        const d = (rng() < 0.5 ? -1 : 1) * randRange(rng, 60, 220);
        p.target = horiz ? { x: clamp(p.x + d, 30, WORLD_W - 30), y: p.y } : { x: p.x, y: clamp(p.y + d, 30, WORLD_H - 30) };
      }
      const a = Math.atan2(p.target.y - p.y, p.target.x - p.x);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * dt;
      p.y += Math.sin(a) * p.speed * dt;
      if (dist(p.x, p.y, p.target.x, p.target.y) < 10) {
        p.target = null;
        p.wait = randRange(rng, 0.5, 4);
      }
    }
    p.x = clamp(p.x, 24, WORLD_W - 24);
    p.y = clamp(p.y, 24, WORLD_H - 24);
    // Don't walk through buildings: nudge out.
    for (const b of colliders) {
      if (p.x > b.x - 12 && p.x < b.x + b.w + 12 && p.y > b.y - 12 && p.y < b.y + b.h + 12) {
        p.target = null;
        p.x -= Math.cos(p.angle) * 30 * dt * 10;
        p.y -= Math.sin(p.angle) * 30 * dt * 10;
      }
    }
  }
}
