// VELMARA — player.js: the player on foot and in a car. One protagonist:
// Mara Voss, a wheelwoman new to Velmara, working off a debt to fixer
// "Tio" Anselmo. On foot: run, sprint, aim and shoot. In a car: drive,
// steal (E), handbrake, horn.
import { clamp, dist, resolveCircleVsBoxes } from './util.js';
import { WORLD_W, WORLD_H, clampToWorld } from './city.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2; // facing
    this.health = 100;
    this.armor = 0;
    this.cash = 250;
    this.ammo = 48;
    this.maxAmmo = 120;
    this.car = null; // Car instance when driving
    this.speed = 0;
    this.onFoot = true;
    this.dead = false;
    this.sprintStamina = 100;
    this.radius = 14;
    this.lastDamageAt = -99;
    this.regenDelay = 6;
  }

  get speedKmh() {
    if (this.car) return Math.abs(this.car.speed) * 0.55;
    return Math.abs(this.speed) * 0.55;
  }

  /** On-foot movement. Returns true if the player moved. */
  moveOnFoot(mx, my, sprint, dt, colliders) {
    const base = sprint && this.sprintStamina > 0 ? 235 : 150;
    if (sprint && (mx !== 0 || my !== 0)) this.sprintStamina = Math.max(0, this.sprintStamina - 22 * dt);
    else this.sprintStamina = Math.min(100, this.sprintStamina + 14 * dt);
    const nx = this.x + mx * base * dt;
    const ny = this.y + my * base * dt;
    const pos = { x: nx, y: ny };
    resolveCircleVsBoxes(pos, this.radius, colliders);
    const clamped = clampToWorld(pos.x, pos.y, this.radius + 2);
    this.x = clamped.x; this.y = clamped.y;
    this.speed = (mx !== 0 || my !== 0) ? base : 0;
    if (mx !== 0 || my !== 0) this.angle = Math.atan2(my, mx);
    return this.speed > 0;
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.parked = false;
    car.traffic = false;
    car.route = null;
  }
  exitCar() {
    if (!this.car) return null;
    const car = this.car;
    this.car = null;
    this.onFoot = true;
    // Step out to the driver's side.
    const side = this.angle + Math.PI / 2;
    this.x = car.x + Math.cos(side) * 30;
    this.y = car.y + Math.sin(side) * 30;
    const c = clampToWorld(this.x, this.y, 20);
    this.x = c.x; this.y = c.y;
    this.angle = car.angle;
    return car;
  }

  hurt(amount, now) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest);
      this.armor -= absorbed; rest -= absorbed;
    }
    this.health -= rest;
    this.lastDamageAt = now;
    if (this.health <= 0) { this.health = 0; this.dead = true; }
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, 100); }
  addCash(amount) { this.cash += amount; }
  spendCash(amount) {
    if (this.cash < amount) return false;
    this.cash -= amount;
    return true;
  }
  /** Slow health regen after a quiet spell, like the genre's health. */
  update(now, dt) {
    if (!this.dead && this.health > 0 && this.health < 100 && now - this.lastDamageAt > this.regenDelay) {
      this.health = Math.min(100, this.health + 4 * dt);
    }
  }
  syncWithCar() {
    if (this.car) { this.x = this.car.x; this.y = this.car.y; this.angle = this.car.angle; }
  }
}

/** Nearest car within reach for stealing / entering. */
export function nearestCar(x, y, cars, maxDist) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    if (c.dead) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
