// traffic.js — cars: arcade driving physics, parked cars to steal,
// live traffic on the road grid, and getting in and out.
// All movement is plain numbers on the game state; drawing lives in view.js.

import { clamp, dist, makeRng, circleRectResolve, turnToward } from './rng.js';
import { VEHICLE_TYPES, inWater } from './world.js';

export function makeVehicle(x, y, angle, type, opts) {
  const t = VEHICLE_TYPES[type] || VEHICLE_TYPES[3];
  return {
    x,
    y,
    angle,
    speed: 0,
    type,
    name: t.name,
    color: t.color,
    top: t.top,
    accel: t.accel,
    grip: t.grip,
    hp: 100,
    smoke: 0,
    traffic: !!(opts && opts.traffic),
    axis: opts && opts.axis ? opts.axis : 'x',
    road: opts && opts.road !== undefined ? opts.road : 0,
    dir: opts && opts.dir ? opts.dir : 1,
    cruise: opts && opts.cruise ? opts.cruise : 90,
    target: !!(opts && opts.target),
    parked: !opts || !opts.traffic,
  };
}

// Arcade car: throttle accelerates, steering scales with speed, SPACE is
// the handbrake (cuts grip, bleeds speed, lets the tail step out).
export function driveCar(G, car, throttle, steer, handbrake, dt) {
  const t = VEHICLE_TYPES[car.type];
  const maxSpeed = (car.hp < 30 ? t.top * 0.6 : t.top) * (car.smoke > 0.6 ? 0.75 : 1);
  if (throttle > 0) car.speed += car.accel * throttle * dt;
  if (throttle < 0) car.speed += car.accel * 0.7 * throttle * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * 42 * dt;
  if (handbrake) car.speed -= Math.sign(car.speed) * 190 * dt;
  car.speed = clamp(car.speed, -maxSpeed * 0.45, maxSpeed);
  if (Math.abs(car.speed) < 2 && throttle === 0) car.speed = 0;

  const speed01 = Math.min(1, Math.abs(car.speed) / 200);
  const steerRate = car.grip * (0.45 + 0.55 * speed01) * (handbrake ? 1.7 : 1);
  car.angle += steer * steerRate * dt * Math.sign(car.speed || 1) * (car.speed < 0 ? -1 : 1);

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;

  // Buildings stop cars; water stops them too (except on bridges).
  const w = G.world;
  for (const b of w.buildings) {
    if (circleRectResolve(car, 20, b)) {
      if (Math.abs(car.speed) > 60) {
        car.hp -= Math.abs(car.speed) * 0.08;
        G.sound.crash();
        burst(G, car.x, car.y, '#ffb347', 10);
        G.cam.shake = Math.min(10, Math.abs(car.speed) * 0.04);
      }
      car.speed *= 0.35;
    }
  }
  if (inWater(w, car.x, car.y)) {
    car.x -= Math.cos(car.angle) * car.speed * dt;
    car.y -= Math.sin(car.angle) * car.speed * dt;
    car.speed *= 0.4;
  }
  car.x = clamp(car.x, 24, w.W - 24);
  car.y = clamp(car.y, 24, w.H - 24);
  if (car.hp < 35) car.smoke = Math.min(1, car.smoke + dt * 0.2);
  return car;
}

export function spawnTraffic(G) {
  const rng = makeRng(G.seed + 77);
  const w = G.world;
  G.traffic = [];
  for (let i = 0; i < 10; i++) {
    const horizontal = rng.chance(0.5);
    let car;
    if (horizontal) {
      const ry = w.roadsY[Math.floor(rng.next() * w.roadsY.length)];
      car = makeVehicle(rng.range(100, w.W - 100), ry, rng.chance(0.5) ? 0 : Math.PI, rng.int(1, 5), {
        traffic: true,
        axis: 'x',
        road: ry,
        dir: rng.chance(0.5) ? 1 : -1,
        cruise: rng.range(70, 130),
      });
    } else {
      const rx = w.roadsX[Math.floor(rng.next() * w.roadsX.length)];
      car = makeVehicle(rx, rng.range(100, w.H - 100), rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2, rng.int(1, 5), {
        traffic: true,
        axis: 'y',
        road: rx,
        dir: rng.chance(0.5) ? 1 : -1,
        cruise: rng.range(70, 130),
      });
    }
    G.traffic.push(car);
  }
}

// Traffic follows its road; at an intersection it may turn, at a dead end
// (the canal on a non-bridge road) it turns around. Simple, dense, alive.
export function stepTraffic(G, dt) {
  const w = G.world;
  for (const car of G.traffic) {
    const targetAngle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += turnToward(car.angle, targetAngle, 2.4 * dt);
    const want = car.cruise;
    car.speed += (want - car.speed) * Math.min(1, dt * 0.8);

    // Slow for the car ahead on the same road.
    for (const other of G.traffic) {
      if (other === car || other.axis !== car.axis || other.road !== car.road) continue;
      const ahead =
        car.axis === 'x'
          ? (other.x - car.x) * car.dir
          : (other.y - car.y) * car.dir;
      if (ahead > 0 && ahead < 90) car.speed = Math.min(car.speed, other.speed * 0.7);
    }

    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;

    // Snap back onto the road line so cars never drift into buildings.
    if (car.axis === 'x') car.y += (car.road - car.y) * Math.min(1, dt * 3);
    else car.x += (car.road - car.x) * Math.min(1, dt * 3);

    // Edges and the canal: clamp the car back in and turn it around at
    // once — flipping dir alone while the angle is still turning would
    // flip it back every frame and drive the car out of the world.
    if (car.axis === 'x') {
      if (car.x < 60) {
        car.x = 60;
        car.dir = 1;
        car.angle = 0;
      } else if (car.x > w.W - 60) {
        car.x = w.W - 60;
        car.dir = -1;
        car.angle = Math.PI;
      }
    } else {
      const nearCanal = car.y > w.canal.y0 - 60 && car.y < w.canal.y1 + 60;
      const onBridge = w.canal.bridges.some((bx) => Math.abs(car.x - bx) < 50);
      if (nearCanal && !onBridge) {
        if (car.dir > 0) {
          car.y = w.canal.y0 - 60;
          car.dir = -1;
          car.angle = -Math.PI / 2;
        } else {
          car.y = w.canal.y1 + 60;
          car.dir = 1;
          car.angle = Math.PI / 2;
        }
      }
      if (car.y < 60) {
        car.y = 60;
        car.dir = 1;
        car.angle = Math.PI / 2;
      } else if (car.y > w.H - 60) {
        car.y = w.H - 60;
        car.dir = -1;
        car.angle = -Math.PI / 2;
      }
    }

    // Random turn at an intersection.
    const onX = w.roadsX.some((rx) => Math.abs(car.x - rx) < 14);
    const onY = w.roadsY.some((ry) => Math.abs(car.y - ry) < 14);
    if (onX && onY && Math.random() < dt * 0.25) {
      if (car.axis === 'x') {
        car.axis = 'y';
        car.road = w.roadsX.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
        car.dir = Math.random() < 0.5 ? 1 : -1;
      } else {
        car.axis = 'x';
        car.road = w.roadsY.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
        car.dir = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }
}

// Nearest stealable car (parked or traffic) within reach of the player.
export function nearestCar(G, maxD) {
  const p = G.player;
  let best = null;
  let bestD = maxD;
  const all = [...G.world.parked.map((pk) => pk.car), ...G.traffic, ...G.cops.map((c) => c.car).filter(Boolean)];
  for (const car of all) {
    if (!car || car.hp <= 0) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.vehicle = car;
  p.onFoot = false;
  car.parked = false;
  if (car.traffic) {
    G.traffic = G.traffic.filter((c) => c !== car);
    car.traffic = false;
  }
  const pk = G.world.parked.find((x) => x.car === car);
  if (pk) pk.taken = true;
  G.sound.engine(0, true);
}

export function exitCar(G) {
  const p = G.player;
  const car = p.vehicle;
  if (!car) return;
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.angle = car.angle;
  p.vehicle = null;
  p.onFoot = true;
  car.speed = 0;
}

export function burst(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    G.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.4, max: 0.9, color, size: 2 + Math.random() * 3 });
  }
}
