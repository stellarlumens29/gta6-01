// boot.js — VELMARA boot: fresh game state, the update loop, screens,
// stealing, saving, and the ?shot= / ?selftest= entry points.
// Importing this module is side-effect free; startGame(canvas) wires the DOM.

import { clamp, dist, makeRng, circleRectResolve } from './rng.js';
import { buildWorld, inWater, districtAt } from './world.js';
import { makeInput, moveAxis, down } from './keys.js';
import { makeSound } from './sound.js';
import { saveGame, loadSave, applySave, hasSave } from './store.js';
import { makeVehicle, driveCar, stepTraffic, spawnTraffic, nearestCar, enterCar, exitCar, burst } from './traffic.js';
import { spawnPeds, stepPeds } from './walkers.js';
import { addHeat, stepHeat, stepCops, roadblocks, starsFor } from './heat.js';
import { playerShoot, stepBullets, stepEnemies, stepParts, hurtPlayer } from './fight.js';
import { stepGold, stepTaxi, startFare, nearShop, buyFromShop, SHOP_STOCK } from './side.js';
import { JOBS, newStory, startJob, stepStory } from './story.js';
import { drawWorld } from './view.js';
import { drawHUD, drawTitle, drawPause, drawHelp, drawEnd } from './panel.js';
import { setupShot } from './scenes.js';
import { runSelfTest } from './check.js';

export const GAME_SEED = 1;

export function createGame(seed) {
  const world = buildWorld(seed);
  // Attach a drivable car object to every parked spot.
  for (const pk of world.parked) {
    pk.car = makeVehicle(pk.x, pk.y, pk.angle, pk.type, { target: !!pk.target });
  }

  const G = {
    seed,
    world,
    time: 0,
    clockMin: 17 * 60 + 20,
    screen: 'title',
    mode: 'story',
    cash: 250,
    debt: 10000,
    jobIndex: 0,
    jobDone: [false, false, false, false, false, false, false, false],
    stats: { kills: 0, stolen: 0, gold: 0, fares: 0 },
    player: {
      x: world.spawn.x,
      y: world.spawn.y,
      angle: -Math.PI / 2,
      hp: 100,
      armor: 0,
      ammo: 60,
      reserve: 120,
      onFoot: true,
      vehicle: null,
      lastHurt: 99,
    },
    traffic: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    parts: [],
    taxi: { active: false },
    story: newStory(),
    wanted: 0,
    heat: 0,
    hidden: 0,
    seenByPolice: false,
    recentShot: 0,
    roadblocks: [],
    cam: { x: 400, y: 300, shake: 0 },
    msgs: [],
    bannerText: null,
    bannerSub: null,
    bannerAt: -99,
    savedFlash: 0,
    muted: false,
    shopOpen: false,
    hasSave: false,
    freeHeatOff: false,
    input: null,
    sound: makeSound(),
  };

  G.msg = (text) => {
    G.msgs.push({ text, at: G.time });
    if (G.msgs.length > 8) G.msgs.shift();
  };
  G.banner = (text, sub) => {
    G.bannerText = text;
    G.bannerSub = sub || '';
    G.bannerAt = G.time;
  };
  G.addCash = (n, why) => {
    G.cash += n;
  };
  G.addHeat = (n, reason) => addHeat(G, n, reason);
  G.saveGame = () => saveGame(G);
  G.busted = () => {
    G.cash = Math.floor(G.cash * 0.85);
    G.wanted = 0;
    G.heat = 0;
    G.cops = [];
    G.enemies = [];
    if (G.player.vehicle) {
      G.player.vehicle.speed = 0;
      G.player.vehicle = null;
    }
    G.player.onFoot = true;
    G.player.x = G.world.spawn.x;
    G.player.y = G.world.spawn.y;
    G.player.hp = Math.max(G.player.hp, 50);
    G.sound.busted();
    G.screen = 'busted';
  };
  G.wasted = () => {
    G.cash = Math.floor(G.cash * 0.85);
    G.wanted = 0;
    G.heat = 0;
    G.cops = [];
    G.enemies = [];
    G.player.vehicle = null;
    G.player.onFoot = true;
    G.player.hp = 100;
    G.player.x = G.world.spawn.x;
    G.player.y = G.world.spawn.y;
    G.sound.busted();
    G.screen = 'wasted';
  };
  G.win = () => {
    G.screen = 'win';
    G.sound.sting(true);
  };

  spawnTraffic(G);
  spawnPeds(G);
  return G;
}

function resumeFromEnd(G) {
  G.player.hp = 100;
  G.screen = 'play';
}

export function update(G, dt, input) {
  G.time += dt;
  G.clockMin = (G.clockMin + dt * 2) % (24 * 60);
  if (G.cam.shake > 0) G.cam.shake = Math.max(0, G.cam.shake - dt * 22);

  // Title backdrop pans slowly across the city.
  if (G.screen === 'title') {
    G.cam.x = (G.time * 26) % (G.world.W - 1280);
    G.cam.y = 420 + Math.sin(G.time * 0.1) * 120;
    return;
  }
  if (G.screen !== 'play') return;

  const p = G.player;

  // --- global keys ---------------------------------------------------------
  if (down(input, 'p', 'Escape')) {
    G.screen = 'pause';
    input.keys.delete('p');
    input.keys.delete('Escape');
    return;
  }
  if (down(input, 'n')) {
    G.muted = !G.muted;
    G.sound.setMuted(G.muted);
    input.keys.delete('n');
  }
  if (down(input, 'm')) {
    if (!G.story.active) startJob(G, G.jobIndex);
    else {
      // Retry the current job from its start.
      const i = G.story.job;
      startJob(G, i);
      G.msg('job restarted');
    }
    input.keys.delete('m');
  }

  // --- shops ---------------------------------------------------------------
  const shop = nearShop(G);
  if (shop && down(input, 'e') && !G.shopOpen) {
    G.shopOpen = true;
    input.keys.delete('e');
  } else if (G.shopOpen) {
    const stock = SHOP_STOCK[shop.kind];
    for (let i = 0; i < stock.length; i++) {
      if (down(input, String(i + 1))) {
        buyFromShop(G, shop, stock[i].id);
        input.keys.delete(String(i + 1));
      }
    }
    if (down(input, 'e')) {
      G.shopOpen = false;
      input.keys.delete('e');
    }
  }

  if (G.shopOpen) {
    stepAmbient(G, dt);
    return;
  }

  // --- driving / walking ---------------------------------------------------
  const axis = moveAxis(input);
  if (p.vehicle) {
    const car = p.vehicle;
    const throttle = axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0;
    const steer = axis.x;
    driveCar(G, car, throttle, steer, down(input, ' '), dt);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (down(input, 'h')) {
      G.sound.horn();
      input.keys.delete('h');
    }
    if (down(input, 'e')) {
      exitCar(G);
      input.keys.delete('e');
    }
    // Pedestrians hit by the car.
    for (const ped of G.peds) {
      if (!ped.hit && Math.abs(car.speed) > 40 && dist(ped.x, ped.y, car.x, car.y) < 26) {
        ped.hit = true;
        ped.panic = 3;
        addHeat(G, 20, 'pedestrian down');
        G.msg('pedestrian hit — the VPD saw that');
        burst(G, ped.x, ped.y, '#ff8a8a', 8);
      }
    }
  } else {
    const sprint = down(input, 'Shift') ? 1.6 : 1;
    const speed = 145 * sprint;
    const ox = p.x;
    const oy = p.y;
    p.x += axis.x * speed * dt;
    p.y += axis.y * speed * dt;
    if (axis.x !== 0 || axis.y !== 0) {
      if (!input.mouse.down) p.angle = Math.atan2(axis.y, axis.x);
    }
    for (const b of G.world.buildings) circleRectResolve(p, 14, b);
    if (inWater(G.world, p.x, p.y)) {
      p.x = ox;
      p.y = oy;
    }
    p.x = clamp(p.x, 20, G.world.W - 20);
    p.y = clamp(p.y, 20, G.world.H - 20);
    // Face the mouse while aiming.
    if (input.mouse.down || input.mouse.clicked) {
      const wx = G.cam.x + input.mouse.x;
      const wy = G.cam.y + input.mouse.y;
      p.angle = Math.atan2(wy - p.y, wx - p.x);
    }
    if (input.mouse.clicked) {
      const wx = G.cam.x + input.mouse.x;
      const wy = G.cam.y + input.mouse.y;
      playerShoot(G, wx, wy);
      input.mouse.clicked = false;
    }
    if (down(input, 'e')) {
      const car = nearestCar(G, 70);
      if (car) {
        enterCar(G, car);
        G.stats.stolen += 1;
        if (!car.traffic) addHeat(G, 20, 'grand theft auto');
        else addHeat(G, 25, 'carjacked in traffic');
        G.msg(`stole the ${car.name}`);
        G.sound.pickup();
      }
      input.keys.delete('e');
    }
    if (down(input, 'r')) {
      if (p.ammo < 60 && p.reserve > 0) {
        const need = Math.min(60 - p.ammo, p.reserve);
        p.ammo += need;
        p.reserve -= need;
        G.msg(`reloaded — ${p.ammo}/60`);
      }
      input.keys.delete('r');
    }
  }

  // --- world systems --------------------------------------------------------
  stepAmbient(G, dt);
  stepStory(G, dt);
  stepGold(G);
  stepTaxi(G, dt);
  stepHeat(G, dt);
  stepCops(G, dt);
  G.roadblocks = roadblocks(G);

  // Health regen after a quiet spell.
  p.lastHurt += dt;
  if (p.lastHurt > 8 && p.hp > 0 && p.hp < 100) {
    p.hp = Math.min(100, p.hp + 4 * dt);
  }

  // Camera follows the player with a shake offset.
  const tx = clamp(p.x - 640, 0, G.world.W - 1280);
  const ty = clamp(p.y - 360, 0, G.world.H - 720);
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  if (G.cam.shake > 0) {
    G.cam.x += (Math.random() - 0.5) * G.cam.shake;
    G.cam.y += (Math.random() - 0.5) * G.cam.shake;
  }

  // Sound layers follow the action.
  const speed01 = p.vehicle ? Math.abs(p.vehicle.speed) / 250 : 0;
  G.sound.engine(speed01, !!p.vehicle);
  G.sound.siren(G.wanted, dt);
}

function stepAmbient(G, dt) {
  stepTraffic(G, dt);
  stepPeds(G, dt);
  stepBullets(G, dt);
  stepEnemies(G, dt);
  stepParts(G, dt);
}

export function render(G, ctx) {
  ctx.save();
  if (G.screen === 'title') {
    drawWorld(ctx, G);
    drawTitle(ctx, G);
  } else if (G.screen === 'play') {
    drawWorld(ctx, G);
    drawHUD(ctx, G);
  } else if (G.screen === 'pause') {
    drawWorld(ctx, G);
    drawPause(ctx, G);
  } else if (G.screen === 'help') {
    drawWorld(ctx, G);
    drawHelp(ctx, G);
  } else if (G.screen === 'win') {
    drawWorld(ctx, G);
    drawEnd(ctx, G, 'win');
  } else if (G.screen === 'busted') {
    drawWorld(ctx, G);
    drawEnd(ctx, G, 'busted');
  } else if (G.screen === 'wasted') {
    drawWorld(ctx, G);
    drawEnd(ctx, G, 'wasted');
  }
  ctx.restore();
}

// --- entry point -----------------------------------------------------------

export function startGame(canvas) {
  const params = new URLSearchParams(window.location.search);
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const G = createGame(seed);
  G.hasSave = hasSave();

  // Headless self-test: run the checks, print them, stop.
  if (params.get('selftest') === '1') {
    const { results, passed, total } = runSelfTest(createGame);
    const lines = results.map((r) => `${r.pass ? 'PASS' : 'FAIL'} ${r.name} — ${r.detail}`);
    lines.push(`SELFTEST ${passed}/${total}`);
    console.log(lines.join('\n'));
    document.title = `SELFTEST ${passed}/${total}`;
    const pre = document.createElement('pre');
    pre.id = 'selftest';
    pre.textContent = lines.join('\n');
    document.body.appendChild(pre);
    return G;
  }

  // Screenshot scene: pose once, draw once, stop.
  const shot = params.get('shot');
  if (shot) {
    G.input = makeInput(canvas);
    setupShot(G, shot);
    const ctx = canvas.getContext('2d');
    render(G, ctx);
    document.title = `SHOT ${shot}`;
    return G;
  }

  // Normal play.
  const input = makeInput(canvas);
  G.input = input;
  const ctx = canvas.getContext('2d');
  input.keys.clear();

  function onKey(e) {
    G.sound.unlock();
    if (G.screen === 'title') {
      if (e.key === '1') {
        const data = loadSave();
        if (data) {
          applySave(G, data);
          G.msg('save loaded — welcome back to Velmara');
        }
        G.mode = 'story';
        G.screen = 'play';
        G.sound.sting(true);
      } else if (e.key === '2') {
        G.mode = 'free';
        G.debt = 0;
        G.freeHeatOff = true;
        G.screen = 'play';
        G.msg('free roam — the city is yours');
      } else if (e.key === '3') {
        G.screen = 'help';
      }
      return;
    }
    if (G.screen === 'help') {
      if (e.key === '3' || e.key === 'Escape') G.screen = 'title';
      return;
    }
    if (G.screen === 'pause') {
      if (e.key === 's' || e.key === 'S') {
        if (saveGame(G)) G.savedFlash = G.time;
      } else if (e.key === 'q' || e.key === 'Q') {
        G.screen = 'title';
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        // update() also watches P/Escape, so take the key out of the set
        // or the next frame would pause again immediately.
        input.keys.delete('p');
        input.keys.delete('P');
        input.keys.delete('Escape');
        G.screen = 'play';
      }
      return;
    }
    if (G.screen === 'busted' || G.screen === 'wasted') {
      if (e.key === 'Enter') resumeFromEnd(G);
      return;
    }
    if (G.screen === 'win') {
      if (e.key === 'Enter') {
        G.mode = 'free';
        G.freeHeatOff = true;
        G.screen = 'play';
      } else if (e.key === 'q' || e.key === 'Q') {
        G.screen = 'title';
      }
    }
  }
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('mousedown', () => G.sound.unlock());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(G, dt, input);
    render(G, ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return G;
}

export { JOBS, districtAt, starsFor, hurtPlayer };
