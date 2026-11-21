// VELMARA — police.js: the wanted system. 0–5 stars. Crimes raise it,
// VPD interceptors and foot officers respond, roadblocks appear at 3+,
// and it cools off when the player stays out of sight. Busted (caught on
// foot) or wasted (health 0) costs cash and clears the heat.
import { clamp, dist, randRange } from './util.js';
import { Car, updatePoliceCar } from './vehicles.js';
import { WORLD_W, WORLD_H, PLACES } from './city.js';

export const WANTED_LABELS = ['Clean', 'Suspect', 'Heat', 'Manhunt', 'Lockdown', 'Citywide Alert'];

export class WantedSystem {
  constructor() {
    this.stars = 0;
    this.heat = 0;          // 0..100, builds while police see the player
    this.hiddenTimer = 0;   // seconds with no police near
    this.cooldown = 0;      // seconds between star changes from crimes
    this.roadblock = false;
  }
  addCrime(stars, now) {
    if (now - this.cooldown < 1.2 && stars <= 1) return false;
    const before = this.stars;
    this.stars = clamp(this.stars + stars, 0, 5);
    this.cooldown = now;
    this.hiddenTimer = 0;
    return this.stars > before;
  }
  /** Decay when unseen; returns stars lost this tick (0 or more). */
  update(dt, nearestPoliceDist, playerSpeed) {
    if (this.stars === 0) { this.hiddenTimer = 0; return 0; }
    const seen = nearestPoliceDist < 430;
    if (seen) { this.hiddenTimer = 0; this.heat = Math.min(100, this.heat + dt * 30); }
    else {
      this.heat = Math.max(0, this.heat - dt * 12);
      // Hiding works faster on foot and still; speeding keeps the heat.
      this.hiddenTimer += dt * (playerSpeed < 60 ? 1.6 : 0.8);
      const need = 7 + this.stars * 2;
      if (this.hiddenTimer >= need) {
        this.hiddenTimer = 0;
        this.stars -= 1;
        return 1;
      }
    }
    this.roadblock = this.stars >= 3;
    return 0;
  }
  clear() { this.stars = 0; this.heat = 0; this.hiddenTimer = 0; this.roadblock = false; }
  label() { return WANTED_LABELS[this.stars]; }
}

export class PoliceOfficer {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = 0;
    this.speed = 165;
    this.radius = 13;
    this.hp = 100;
    this.dead = false;
    this.shootTimer = 0;
  }
}

/** Spawn / maintain the police force for the current wanted level. */
export function maintainPolice(policeCars, officers, wanted, player, rng, dt, now) {
  const wantCars = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
  const wantOfficers = wanted >= 2 ? Math.min(wanted - 1, 4) : 0;
  // Spawn cars at the map edge nearest the player but off-screen.
  while (policeCars.length < wantCars) {
    const edge = Math.floor(rng() * 4);
    let x, y;
    if (edge === 0) { x = randRange(rng, 100, WORLD_W - 100); y = 60; }
    else if (edge === 1) { x = randRange(rng, 100, WORLD_W - 100); y = WORLD_H - 60; }
    else if (edge === 2) { x = 60; y = randRange(rng, 100, WORLD_H - 100); }
    else { x = WORLD_W - 60; y = randRange(rng, 100, WORLD_H - 100); }
    if (dist(x, y, player.x, player.y) < 500) continue;
    const car = new Car(x, y, 0, 'police', rng);
    car.traffic = false;
    policeCars.push(car);
  }
  while (policeCars.length > wantCars) policeCars.pop();
  while (officers.length < wantOfficers) {
    const a = randRange(rng, 0, Math.PI * 2);
    const d = randRange(rng, 260, 420);
    officers.push(new PoliceOfficer(
      clamp(player.x + Math.cos(a) * d, 40, WORLD_W - 40),
      clamp(player.y + Math.sin(a) * d, 40, WORLD_H - 40),
    ));
  }
  while (officers.length > wantOfficers) officers.pop();
  // Move the force.
  for (const car of policeCars) {
    if (car.dead) continue;
    updatePoliceCar(car, dt, player.x, player.y, rng);
  }
  for (const o of officers) {
    if (o.dead) continue;
    const d = dist(o.x, o.y, player.x, player.y);
    if (d > 26) {
      const a = Math.atan2(player.y - o.y, player.x - o.x);
      o.angle = a;
      o.x += Math.cos(a) * o.speed * dt;
      o.y += Math.sin(a) * o.speed * dt;
    }
  }
  void now;
}

/** Nearest police distance to the player (cars + officers). */
export function nearestPoliceDist(policeCars, officers, player) {
  let best = Infinity;
  for (const c of policeCars) if (!c.dead) best = Math.min(best, dist(c.x, c.y, player.x, player.y));
  for (const o of officers) if (!o.dead) best = Math.min(best, dist(o.x, o.y, player.x, player.y));
  return best;
}

/** Busted check: an officer touches the on-foot player while wanted. */
export function checkBusted(officers, player, wanted) {
  if (wanted === 0 || !player.onFoot || player.dead) return false;
  for (const o of officers) {
    if (o.dead) continue;
    if (dist(o.x, o.y, player.x, player.y) < 26) return true;
  }
  return false;
}

export function bustPenalty(player) {
  const lost = Math.floor(player.cash * 0.15);
  player.cash -= lost;
  return lost;
}

export function respawnAfterBusted(player) {
  player.x = PLACES.police.x; player.y = PLACES.police.y + 60;
  player.health = 100; player.armor = 0;
  if (player.car) { player.car = null; player.onFoot = true; }
}
export function respawnAfterWasted(player) {
  player.x = PLACES.hospital.x; player.y = PLACES.hospital.y + 60;
  player.health = 100; player.armor = 0;
  if (player.car) { player.car = null; player.onFoot = true; }
}
