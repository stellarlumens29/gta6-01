// walkers.js — pedestrians: they stroll the sidewalks, chat in place,
// and run from gunfire. Hitting one with a car is a crime.

import { makeRng, clamp, dist, angleTo } from './rng.js';
import { inWater } from './world.js';

const SHIRTS = ['#e8e3d8', '#d96a5f', '#5f8fd9', '#e0b13e', '#7fb069', '#c77dff', '#f2f2f2', '#3a3a3a'];

export function spawnPeds(G) {
  const rng = makeRng(G.seed + 31);
  const w = G.world;
  G.peds = [];
  for (let i = 0; i < 26; i++) {
    const rx = w.roadsX[Math.floor(rng.next() * w.roadsX.length)];
    const ry = w.roadsY[Math.floor(rng.next() * w.roadsY.length)];
    let x = rx + rng.range(-90, 90);
    let y = ry + rng.range(-90, 90);
    if (inWater(w, x, y)) y = ry + 90;
    G.peds.push({
      x: clamp(x, 40, w.W - 40),
      y: clamp(y, 40, w.H - 40),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(24, 46),
      shirt: SHIRTS[i % SHIRTS.length],
      state: 'stroll',
      panic: 0,
      pause: rng.range(0, 3),
    });
  }
}

export function stepPeds(G, dt) {
  const w = G.world;
  const gunfire = G.bullets.length > 0 || G.recentShot > 0;
  for (const ped of G.peds) {
    if (ped.panic > 0) ped.panic -= dt;
    const px = G.player.x;
    const py = G.player.y;
    const dPlayer = dist(ped.x, ped.y, px, py);
    const scared = gunfire && dPlayer < 420;
    if (scared) ped.panic = 2.5;

    if (ped.panic > 0) {
      ped.state = 'flee';
      ped.angle = angleTo(px, py, ped.x, ped.y);
      ped.x += Math.cos(ped.angle) * 130 * dt;
      ped.y += Math.sin(ped.angle) * 130 * dt;
    } else if (ped.pause > 0) {
      ped.pause -= dt;
      ped.state = 'idle';
    } else {
      ped.state = 'stroll';
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (Math.random() < dt * 0.12) ped.angle += (Math.random() - 0.5) * 1.8;
      if (Math.random() < dt * 0.05) ped.pause = 1 + Math.random() * 3;
    }

    // Stay out of buildings and water; stay in the world.
    for (const b of w.buildings) {
      if (ped.x > b.x - 8 && ped.x < b.x + b.w + 8 && ped.y > b.y - 8 && ped.y < b.y + b.d + 8) {
        ped.angle += Math.PI / 2;
        ped.x += Math.cos(ped.angle) * 30 * dt;
        ped.y += Math.sin(ped.angle) * 30 * dt;
      }
    }
    if (inWater(w, ped.x, ped.y)) {
      ped.angle += Math.PI;
      ped.x += Math.cos(ped.angle) * 40 * dt;
      ped.y += Math.sin(ped.angle) * 40 * dt;
    }
    ped.x = clamp(ped.x, 30, w.W - 30);
    ped.y = clamp(ped.y, 30, w.H - 30);

    // Run over by the player's car: a crime, and the ped goes down.
    if (!G.player.onFoot && G.player.vehicle) {
      const car = G.player.vehicle;
      if (Math.abs(car.speed) > 40 && dist(ped.x, ped.y, car.x, car.y) < 26) {
        ped.panic = 3;
        ped.x += Math.cos(ped.angle) * 60;
        ped.y += Math.sin(ped.angle) * 60;
        if (!ped.hit) {
          ped.hit = true;
          G.addHeat(1, 'pedestrian down');
          G.msg('pedestrian hit — the VPD saw that');
        }
      }
    }
  }
}
