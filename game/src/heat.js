// heat.js — the wanted system: 0–5 stars, VPD interceptors that chase by
// road routing, foot officers, roadblocks at 3+, cool-off when unseen,
// and the busted / wasted endings.

import { clamp, dist, angleTo, makeRng, turnToward } from './rng.js';
import { makeVehicle, driveCar, burst } from './traffic.js';
import { nearestRoad } from './world.js';

const STAR_HEAT = [0, 20, 45, 75, 110, 150];

export function addHeat(G, n, reason) {
  if (G.mode === 'free' && G.freeHeatOff) return;
  G.heat = clamp(G.heat + n, 0, 160);
  const stars = starsFor(G.heat);
  if (stars > G.wanted) {
    G.wanted = stars;
    G.msg(`wanted level ${stars} star${stars > 1 ? 's' : ''}${reason ? ' — ' + reason : ''}`);
    if (stars >= 3) G.msg('VPD roadblocks ahead — stay off the main roads');
  }
}

export function starsFor(heat) {
  let s = 0;
  for (let i = 1; i <= 5; i++) if (heat >= STAR_HEAT[i]) s = i;
  return s;
}

// Heat cools only while no cop can see the player; hiding breaks line of
// sight, driving fast in the open does not.
export function stepHeat(G, dt) {
  const p = G.player;
  let seen = false;
  for (const c of G.cops) {
    if (dist(c.x, c.y, p.x, p.y) < (c.onFoot ? 260 : 420)) {
      seen = true;
      break;
    }
  }
  G.seenByPolice = seen;
  if (!seen && G.wanted > 0) {
    G.hidden += dt;
    G.heat -= dt * (G.hidden > 6 ? 7 : 3.5);
  } else {
    G.hidden = 0;
  }
  if (G.heat <= 0) {
    G.heat = 0;
    if (G.wanted > 0) {
      G.wanted = 0;
      G.cops = [];
      G.msg('you lost them — heat is off');
    }
  } else {
    G.wanted = starsFor(G.heat);
  }
  // Spawn pressure matches the stars: 1 interceptor per star (cap 3 cars)
  // plus a foot officer from 2 stars up.
  const wantCars = Math.min(3, G.wanted);
  const carsNow = G.cops.filter((c) => !c.onFoot).length;
  if (G.wanted > 0 && carsNow < wantCars && Math.random() < dt * 0.8) {
    spawnInterceptor(G);
  }
  const wantFoot = G.wanted >= 2 ? Math.min(3, G.wanted - 1) : 0;
  const footNow = G.cops.filter((c) => c.onFoot).length;
  if (G.wanted > 0 && footNow < wantFoot && Math.random() < dt * 0.6) {
    spawnOfficer(G);
  }
}

function spawnInterceptor(G) {
  const p = G.player;
  const rng = makeRng((Math.random() * 1e9) | 0);
  const road = nearestRoad(G.world, p.x, p.y);
  let x = p.x + rng.range(500, 700) * (rng.chance(0.5) ? 1 : -1);
  let y = p.y + rng.range(400, 600) * (rng.chance(0.5) ? 1 : -1);
  if (road) {
    if (road.axis === 'x') {
      x = p.x + (rng.chance(0.5) ? 520 : -520);
      y = road.at;
    } else {
      x = road.at;
      y = p.y + (rng.chance(0.5) ? 520 : -520);
    }
  }
  x = clamp(x, 60, G.world.W - 60);
  y = clamp(y, 60, G.world.H - 60);
  const car = makeVehicle(x, y, angleTo(x, y, p.x, p.y), 6, { traffic: false });
  car.hp = 120;
  G.cops.push({ x, y, angle: car.angle, onFoot: false, car, hp: 120, siren: true });
}

function spawnOfficer(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * 320, 40, G.world.W - 40);
  const y = clamp(p.y + Math.sin(a) * 320, 40, G.world.H - 40);
  G.cops.push({ x, y, angle: angleTo(x, y, p.x, p.y), onFoot: true, car: null, hp: 60, cooldown: 1 });
}

export function stepCops(G, dt) {
  const p = G.player;
  for (const c of G.cops) {
    const d = dist(c.x, c.y, p.x, p.y);
    if (c.onFoot) {
      // Foot officers close in on foot, and shoot when close.
      c.angle = angleTo(c.x, c.y, p.x, p.y);
      if (d > 60) {
        c.x += Math.cos(c.angle) * 132 * dt;
        c.y += Math.sin(c.angle) * 132 * dt;
      }
      c.cooldown -= dt;
      if (c.cooldown <= 0 && d < 380 && p.onFoot) {
        c.cooldown = 1.4 + Math.random() * 0.8;
        const a = c.angle + (Math.random() - 0.5) * 0.24;
        G.bullets.push({
          x: c.x + Math.cos(a) * 22,
          y: c.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 470,
          vy: Math.sin(a) * 470,
          angle: a,
          friendly: false,
          life: 1.1,
        });
        G.sound.enemyShot();
      }
      // Busted: an officer touches Mara on foot.
      if (d < 26 && p.onFoot) {
        G.busted();
        return;
      }
    } else {
      // Interceptors drive the roads toward the player: pick the axis
      // that closes the bigger gap, steer onto the nearest road, ram.
      const car = c.car;
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      let wantAngle;
      if (Math.abs(dx) > Math.abs(dy)) wantAngle = dx > 0 ? 0 : Math.PI;
      else wantAngle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
      // Snap onto a road line first when far off-road.
      const road = nearestRoad(G.world, car.x, car.y);
      if (road && d > 320) {
        const offRoad = road.axis === 'x' ? Math.abs(car.y - road.at) : Math.abs(car.x - road.at);
        if (offRoad > 40) {
          wantAngle = road.axis === 'x' ? (car.y < road.at ? Math.PI / 2 : -Math.PI / 2) : car.x < road.at ? 0 : Math.PI;
        }
      }
      car.angle += turnToward(car.angle, wantAngle, 2.6 * dt);
      const throttle = d > 90 ? 1 : 0.4;
      driveCar(G, car, throttle, 0, false, dt);
      c.x = car.x;
      c.y = car.y;
      c.angle = car.angle;
      // Ram: contact with the player's car damages it; contact on foot
      // while slow is a bust.
      if (p.vehicle && dist(car.x, car.y, p.vehicle.x, p.vehicle.y) < 46) {
        p.vehicle.hp -= 14 * dt * 10;
        p.vehicle.speed *= 0.92;
        burst(G, car.x, car.y, '#9db8d6', 4);
        G.cam.shake = Math.min(8, G.cam.shake + 2);
        if (p.vehicle.hp <= 0) {
          p.vehicle.hp = 0;
          G.msg('your car is wrecked — run');
        }
      }
      if (p.onFoot && d < 30 && Math.abs(car.speed) < 60) {
        G.busted();
        return;
      }
    }
  }
}

// Roadblocks at 3+ stars: a line of parked interceptors across the road
// ahead of the player. Pure scenery + collision via their car bodies.
export function roadblocks(G) {
  if (G.wanted < 3) return [];
  const p = G.player;
  const blocks = [];
  const road = nearestRoad(G.world, p.x, p.y);
  if (!road) return blocks;
  const ahead = 420;
  if (road.axis === 'x') {
    blocks.push({ x: p.x + ahead, y: road.at - 40 });
    blocks.push({ x: p.x + ahead, y: road.at + 40 });
  } else {
    blocks.push({ x: road.at - 40, y: p.y + ahead });
    blocks.push({ x: road.at + 40, y: p.y + ahead });
  }
  return blocks;
}
