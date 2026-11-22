// scenes.js — deterministic screenshot scenes (?shot=…&seed=1).
// Each scene poses the same live game state the player sees: title,
// driving, a wanted chase, a dockside shootout. No new systems here —
// just the game, arranged.

import { startJob } from './story.js';
import { enterCar, makeVehicle } from './traffic.js';
import { spawnEnemy } from './fight.js';
import { fireBullet } from './fight.js';

export const SHOT_NAMES = ['title', 'drive', 'chase', 'mission'];

function putPlayerInCar(G, x, y, angle, speed) {
  const car = G.world.parked[0].car;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.hp = 100;
  enterCar(G, car);
  G.player.x = x;
  G.player.y = y;
  G.player.angle = angle;
}

function aimCamera(G) {
  const p = G.player;
  G.cam.x = Math.max(0, Math.min(G.world.W - 1280, p.x - 640));
  G.cam.y = Math.max(0, Math.min(G.world.H - 720, p.y - 360));
}

export function setupShot(G, name) {
  G.time = 12;
  G.clockMin = 17 * 60 + 35;
  if (name === 'title') {
    G.screen = 'title';
    G.cam.x = 900;
    G.cam.y = 420;
    return;
  }

  G.screen = 'play';
  if (name === 'drive') {
    startJob(G, 0);
    putPlayerInCar(G, 2240, 540, 0, 175);
    G.player.hp = 100;
    G.player.ammo = 60;
    G.player.reserve = 120;
    G.cash = 250;
    G.debt = 10000;
    aimCamera(G);
    return;
  }

  if (name === 'chase') {
    startJob(G, 3);
    putPlayerInCar(G, 1500, 540, 0, 155);
    G.player.hp = 88;
    G.wanted = 3;
    G.heat = 80;
    G.cash = 1240;
    G.debt = 8750;
    // Two interceptors on the tail.
    for (const [dx, dy] of [[-260, 60], [-420, -50]]) {
      const car = makeVehicle(G.player.x + dx, G.player.y + dy, 0, 6, { traffic: false });
      car.speed = 150;
      car.hp = 120;
      G.cops.push({ x: car.x, y: car.y, angle: 0, onFoot: false, car, hp: 120, siren: true });
    }
    aimCamera(G);
    return;
  }

  if (name === 'mission') {
    startJob(G, 4);
    // Skip to the ambush step: meet the buyer, then the crew arrives.
    // Mara stands in open ground by the docks, clear of traffic.
    G.player.x = 2440;
    G.player.y = 1240;
    G.player.hp = 73;
    G.player.ammo = 43;
    G.player.reserve = 120;
    G.wanted = 2;
    G.heat = 50;
    G.cash = 2100;
    G.debt = 8300;
    G.story.step = 1;
    G.story.stepState = { spawned: 0 };
    for (let n = 0; n < 4; n++) {
      const a = (n / 4) * Math.PI * 2 + 0.4;
      spawnEnemy(G, 2440 + Math.cos(a) * 220, 1240 + Math.sin(a) * 200, 60);
    }
    // Tracers already in the air.
    fireBullet(G, 2380, 1200, 0.3, true);
    fireBullet(G, 2560, 1360, Math.PI + 0.4, false, 480);
    fireBullet(G, 2320, 1380, -0.5, false, 480);
    aimCamera(G);
    return;
  }

  G.screen = 'title';
}
