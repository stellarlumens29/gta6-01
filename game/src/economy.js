// VELMARA — economy.js: money beyond missions. 12 hidden gold bars,
// the taxi trade (pick up a fare, drop them off, get paid + tipped), and
// two shops: Marty's Guns & Meds (ammo, armor, health) and Rosa Auto
// Repair (fix your car). All prices fixed, all in the world.
import { dist, randInt } from './util.js';
import { PLACES, intersection, COLS, ROWS } from './city.js';

export const GOLD_BAR_VALUE = 150;
export const AMMO_PRICE = 50;
export const AMMO_AMOUNT = 48;
export const ARMOR_PRICE = 200;
export const HEALTH_PRICE = 100;
export const REPAIR_PRICE = 100;

export function spawnGoldBars(rng, colliders) {
  const bars = [];
  let guard = 0;
  while (bars.length < 12 && guard < 300) {
    guard += 1;
    const p = intersection(randInt(rng, 0, COLS - 1), randInt(rng, 0, ROWS - 1));
    const x = p.x + (rng() < 0.5 ? -1 : 1) * (60 + rng() * 120);
    const y = p.y + (rng() < 0.5 ? -1 : 1) * (60 + rng() * 120);
    let bad = false;
    for (const b of colliders) {
      if (x > b.x - 20 && x < b.x + b.w + 20 && y > b.y - 20 && y < b.y + b.h + 20) { bad = true; break; }
    }
    if (bad) continue;
    if (bars.some((g) => dist(g.x, g.y, x, y) < 120)) continue;
    bars.push({ x, y, taken: false });
  }
  return bars;
}

/** Taxi state machine: idle -> pickup -> dropoff -> paid. */
export class TaxiRun {
  constructor() {
    this.active = false;
    this.phase = 'idle'; // pickup | dropoff
    this.pickup = null;
    this.dropoff = null;
    this.fare = 0;
    this.timer = 0;
    this.faresDone = 0;
    this.faresTarget = 0;
  }
  start(count, rng) {
    this.active = true;
    this.rng = rng;
    this.faresDone = 0;
    this.faresTarget = count;
    this.nextFare(rng);
  }
  nextFare(rng) {
    const r = rng || this.rng;
    const pick = () => intersection(randInt(r, 0, COLS - 1), randInt(r, 0, ROWS - 1));
    this.pickup = pick();
    this.dropoff = pick();
    while (dist(this.pickup.x, this.pickup.y, this.dropoff.x, this.dropoff.y) < 500) this.dropoff = pick();
    this.phase = 'pickup';
    this.fare = 60 + Math.round(dist(this.pickup.x, this.pickup.y, this.dropoff.x, this.dropoff.y) / 12);
    this.timer = 90;
  }
  update(dt, player, onPickup, onDropoff) {
    if (!this.active) return;
    this.timer -= dt;
    if (this.timer <= 0) {
      // Fare expired: next fare, no pay.
      this.nextFare(this.rng);
      return;
    }
    if (this.phase === 'pickup') {
      if (dist(player.x, player.y, this.pickup.x, this.pickup.y) < 70 && !player.onFoot) {
        this.phase = 'dropoff';
        this.timer = 90;
        onPickup();
      }
    } else if (this.phase === 'dropoff') {
      if (dist(player.x, player.y, this.dropoff.x, this.dropoff.y) < 70 && !player.onFoot) {
        const paid = this.fare;
        this.faresDone += 1;
        onDropoff(paid);
        if (this.faresDone >= this.faresTarget) { this.active = false; this.phase = 'idle'; }
        else this.nextFare(this.rng);
      }
    }
  }
  stop() { this.active = false; this.phase = 'idle'; }
}

/** Shop interaction: returns a message describing what happened. */
export function shopAction(kind, player) {
  if (kind === 'gunshop') {
    if (player.ammo >= player.maxAmmo && player.armor >= 100 && player.health >= 100) return 'Nothing to buy — ammo, armor and health are full.';
    if (player.ammo < player.maxAmmo && player.spendCash(AMMO_PRICE)) {
      player.ammo = Math.min(player.maxAmmo, player.ammo + AMMO_AMOUNT);
      return 'Bought ' + AMMO_AMOUNT + ' rounds for $' + AMMO_PRICE + '.';
    }
    if (player.armor < 100 && player.spendCash(ARMOR_PRICE)) {
      player.armor = 100;
      return 'Bought a vest for $' + ARMOR_PRICE + '. Armor full.';
    }
    if (player.health < 100 && player.spendCash(HEALTH_PRICE)) {
      player.heal(100);
      return 'Patched up for $' + HEALTH_PRICE + '. Health full.';
    }
    return 'Not enough cash — ammo $50, vest $200, patch-up $100.';
  }
  if (kind === 'repair') {
    const car = player.car;
    if (!car) return 'Bring a car to Rosa first.';
    if (car.health >= 100) return 'This car is already mint.';
    if (player.spendCash(REPAIR_PRICE)) {
      car.health = 100; car.smoke = 0;
      return 'Rosa fixed your ' + car.name + ' for $' + REPAIR_PRICE + '.';
    }
    return 'Repair costs $' + REPAIR_PRICE + ' — you are short.';
  }
  return '';
}

export function nearestShop(player) {
  const dGun = dist(player.x, player.y, PLACES.gunshop.x, PLACES.gunshop.y);
  const dRep = dist(player.x, player.y, PLACES.repair.x, PLACES.repair.y);
  if (dGun < 90) return 'gunshop';
  if (dRep < 90) return 'repair';
  return null;
}
