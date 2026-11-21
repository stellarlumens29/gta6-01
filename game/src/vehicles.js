// VELMARA — vehicles.js: cars to steal and drive. Arcade physics
// (accel, steering that scales with speed, handbrake drift), traffic that
// follows the road grid, parked cars, damage, and police variants.
import { clamp, angleDiff, dist, randRange, randInt, pick } from './util.js';
import { ROAD, COLS, ROWS, intersection, nearestIntersection, WORLD_W, WORLD_H } from './city.js';

export const CAR_TYPES = {
  sedan: { name: 'Alba Sedan', topSpeed: 320, accel: 240, turn: 2.6, color: '#c94f43', price: 0 },
  coupe: { name: 'Veloce GT', topSpeed: 430, accel: 330, turn: 3.0, color: '#ffd23f', price: 0 },
  taxi: { name: 'City Taxi', topSpeed: 300, accel: 220, turn: 2.7, color: '#f2c14e', price: 0 },
  truck: { name: 'Hauler Truck', topSpeed: 240, accel: 170, turn: 2.0, color: '#5b8def', price: 0 },
  van: { name: 'Cargo Van', topSpeed: 270, accel: 190, turn: 2.2, color: '#7fb069', price: 0 },
  police: { name: 'VPD Interceptor', topSpeed: 400, accel: 320, turn: 3.1, color: '#2b3a55', price: 0 },
  muscle: { name: 'Toro Muscle', topSpeed: 380, accel: 300, turn: 2.5, color: '#8d6fb8', price: 0 },
};
const CAR_COLORS = ['#c94f43', '#3f8fbf', '#f2c14e', '#7fb069', '#e8e2d5', '#5b5b6b', '#ff8fab', '#4fb3c9'];

export class Car {
  constructor(x, y, angle, type, rng) {
    const t = CAR_TYPES[type] || CAR_TYPES.sedan;
    this.x = x; this.y = y; this.angle = angle;
    this.type = type;
    this.name = t.name;
    this.topSpeed = t.topSpeed; this.accel = t.accel; this.turn = t.turn;
    this.color = type === 'taxi' ? '#f2c14e' : type === 'police' ? '#2b3a55' : (rng ? pick(rng, CAR_COLORS) : t.color);
    this.speed = 0;
    this.health = 100;
    this.w = 44; this.h = 22;
    this.parked = false;
    this.traffic = false;
    this.route = null; // traffic: {ix, iy, tx, ty}
    this.stuckTimer = 0;
    this.dead = false;
    this.smoke = 0;
    this.headlights = false;
  }
  get radius() { return 20; }

  /** Player driving: throttle -1..1, steer -1..1, dt seconds. */
  drive(throttle, steer, dt, handbrake) {
    const maxReverse = this.topSpeed * 0.45;
    if (throttle > 0) this.speed += this.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 5) this.speed -= this.accel * 1.4 * dt; // brake
      else this.speed += this.accel * 0.7 * throttle * dt; // reverse
    } else {
      this.speed -= Math.sign(this.speed) * 90 * dt;
      if (Math.abs(this.speed) < 4) this.speed = 0;
    }
    if (handbrake) this.speed -= Math.sign(this.speed) * 260 * dt;
    this.speed = clamp(this.speed, -maxReverse, this.topSpeed);
    const grip = handbrake ? 1.9 : 1;
    const spd = Math.abs(this.speed) / this.topSpeed;
    this.angle += steer * this.turn * grip * clamp(spd * 1.6, 0, 1) * Math.sign(this.speed || 1) * dt;
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.x = clamp(this.x, 20, WORLD_W - 20);
    this.y = clamp(this.y, 20, WORLD_H - 20);
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 30) this.smoke = 1;
    if (this.health <= 0) { this.health = 0; this.dead = true; this.speed = 0; }
  }
}

/** Spawn parked cars along road edges across the city. */
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  const types = ['sedan', 'coupe', 'taxi', 'truck', 'van', 'muscle'];
  let guard = 0;
  while (cars.length < count && guard < count * 20) {
    guard += 1;
    const ix = randInt(rng, 0, COLS - 1);
    const iy = randInt(rng, 0, ROWS - 1);
    const horizontal = rng() < 0.5;
    const p = intersection(ix, iy);
    const off = randRange(rng, 90, 260) * (rng() < 0.5 ? -1 : 1);
    const x = horizontal ? p.x + off : p.x + (rng() < 0.5 ? -46 : 46);
    const y = horizontal ? p.y + (rng() < 0.5 ? -46 : 46) : p.y + off;
    if (x < 40 || y < 40 || x > WORLD_W - 40 || y > WORLD_H - 40) continue;
    // Never on top of a building.
    let bad = false;
    for (const b of city.colliders) {
      if (x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30) { bad = true; break; }
    }
    if (bad) continue;
    if (cars.some((c) => dist(c.x, c.y, x, y) < 70)) continue;
    const car = new Car(x, y, horizontal ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2), pick(rng, types), rng);
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

/** Traffic car update: follow the road grid toward a target intersection. */
export function updateTrafficCar(car, dt, allCars, colliders, rng) {
  if (!car.route) {
    const n = nearestIntersection(car.x, car.y);
    const tx = randInt(rng, 0, COLS - 1);
    const ty = randInt(rng, 0, ROWS - 1);
    car.route = { ix: n.ix, iy: n.iy, tx, ty, target: intersection(tx, ty) };
  }
  const r = car.route;
  const target = r.target;
  // Drive toward the current corner: first along x to the target column, then y.
  const cur = nearestIntersection(car.x, car.y);
  let waypoint = null;
  if (cur.ix !== r.tx) {
    const nx = cur.ix + Math.sign(r.tx - cur.ix);
    waypoint = intersection(nx, cur.iy);
  } else if (cur.iy !== r.ty) {
    const ny = cur.iy + Math.sign(r.ty - cur.iy);
    waypoint = intersection(cur.ix, ny);
  } else {
    waypoint = target;
  }
  const wantAngle = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
  const diff = angleDiff(car.angle, wantAngle);
  const steer = clamp(diff * 2.2, -1, 1);
  // Slow for the car ahead.
  let slow = false;
  for (const other of allCars) {
    if (other === car || other.dead) continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d < 64) {
      const a = Math.atan2(other.y - car.y, other.x - car.x);
      if (Math.abs(angleDiff(car.angle, a)) < 0.7) { slow = true; break; }
    }
  }
  const cruise = slow ? 0 : 1;
  car.drive(cruise * 0.55, steer, dt, false);
  car.speed = clamp(car.speed, 0, 120);
  // Snap around if hopelessly stuck against a building.
  if (Math.abs(car.speed) < 8) car.stuckTimer += dt; else car.stuckTimer = 0;
  if (car.stuckTimer > 2.5) {
    car.angle += Math.PI / 2; car.stuckTimer = 0;
    car.x = clamp(car.x, 40, WORLD_W - 40); car.y = clamp(car.y, 40, WORLD_H - 40);
  }
  if (dist(car.x, car.y, target.x, target.y) < 60) car.route = null;
}

/** Police car pursuit: route along the grid toward the player's intersection. */
export function updatePoliceCar(car, dt, targetX, targetY, rng) {
  const t = nearestIntersection(targetX, targetY);
  const cur = nearestIntersection(car.x, car.y);
  let waypoint;
  if (Math.abs(cur.ix - t.ix) > Math.abs(cur.iy - t.iy)) {
    waypoint = intersection(cur.ix + Math.sign(t.ix - cur.ix || 1), cur.iy);
  } else if (cur.iy !== t.iy) {
    waypoint = intersection(cur.ix, cur.iy + Math.sign(t.iy - cur.iy));
  } else {
    waypoint = { x: targetX, y: targetY };
  }
  const wantAngle = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
  const diff = angleDiff(car.angle, wantAngle);
  car.drive(1, clamp(diff * 2.4, -1, 1), dt, false);
  car.speed = clamp(car.speed, 0, car.topSpeed);
  if (Math.abs(car.speed) < 8) car.stuckTimer += dt; else car.stuckTimer = 0;
  if (car.stuckTimer > 2) { car.angle += Math.PI / 2; car.stuckTimer = 0; }
}
