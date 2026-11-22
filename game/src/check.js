// check.js — headless self-test (?selftest=1): 18 logic checks, including
// a scripted full 8-mission playthrough. Runs in the browser with no
// input; results go to the console, document.title and a <pre> in the DOM
// so headless Chrome can read them back.

import { buildWorld } from './world.js';
import { startJob, stepStory, JOBS } from './story.js';
import { enterCar, stepTraffic } from './traffic.js';
import { spawnEnemy, stepBullets } from './fight.js';
import { stepGold, startFare, stepTaxi, buyFromShop } from './side.js';
import { addHeat, stepHeat, stepCops } from './heat.js';
import { saveGame, loadSave } from './store.js';
import { drawWorld, drawMinimap } from './view.js';
import { drawHUD } from './panel.js';

export function runSelfTest(createGame) {
  const results = [];
  function check(name, fn) {
    try {
      const detail = fn();
      results.push({ name, pass: true, detail: detail || '' });
    } catch (err) {
      results.push({ name, pass: false, detail: String(err && err.message ? err.message : err) });
    }
  }
  function assert(cond, msg) {
    if (!cond) throw new Error(msg || 'assert failed');
  }

  check('world deterministic', () => {
    const a = buildWorld(1);
    const b = buildWorld(1);
    assert(a.buildings.length === b.buildings.length, 'building count differs');
    assert(a.buildings[0].x === b.buildings[0].x && a.buildings[0].y === b.buildings[0].y, 'first building differs');
    return `${a.buildings.length} buildings, seed-stable`;
  });

  check('world contents', () => {
    const w = buildWorld(1);
    assert(w.buildings.length === 62, `expected 62 buildings, got ${w.buildings.length}`);
    assert(w.parked.length === 16, `expected 16 parked cars, got ${w.parked.length}`);
    assert(w.goldSpots.length === 12, `expected 12 gold bars, got ${w.goldSpots.length}`);
    assert(w.districts.length === 7, 'expected 7 districts');
    assert(w.shops.length === 2, 'expected 2 shops');
    return '62 buildings, 16 parked, 12 gold, 7 districts, 2 shops';
  });

  check('player starts on foot', () => {
    const G = createGame(1);
    assert(G.player.onFoot === true, 'player should start on foot');
    assert(G.player.hp === 100, 'hp should start at 100');
    assert(G.cash === 250 && G.debt === 10000, 'cash/debt start wrong');
    return 'spawn ok, $250, $10,000 debt';
  });

  check('mission 1 completes', () => {
    const G = createGame(1);
    startJob(G, 0);
    const car = G.world.parked[2].car;
    enterCar(G, car);
    assert(G.player.vehicle === car, 'enterCar failed');
    G.player.x = 1710;
    G.player.y = 1370;
    for (let i = 0; i < 20 && !G.jobDone[0]; i++) stepStory(G, 0.5);
    assert(G.jobDone[0] === true, 'job 1 did not complete');
    assert(G.debt === 9700, `debt should be 9700, got ${G.debt}`);
    return 'job 1 done, debt $9,700';
  });

  check('wanted raise and cool-off', () => {
    const G = createGame(1);
    addHeat(G, 25, 'test');
    assert(G.wanted === 1, `wanted should be 1, got ${G.wanted}`);
    G.cops = [];
    for (let i = 0; i < 120 && G.wanted > 0; i++) {
      G.cops = G.cops.filter((c) => false);
      stepHeat(G, 0.5);
    }
    assert(G.wanted === 0, `wanted should cool to 0, got ${G.wanted}`);
    return '1 star raised, cooled to 0';
  });

  check('target car steal', () => {
    const G = createGame(1);
    const target = G.world.parked.find((pk) => pk.target);
    assert(target && target.car, 'no target car');
    enterCar(G, target.car);
    assert(G.player.vehicle.target === true, 'target flag missing on stolen car');
    return 'yellow Veloce GT stolen';
  });

  check('bullet hits enemy', () => {
    const G = createGame(1);
    const e = spawnEnemy(G, G.player.x + 120, G.player.y, 60);
    const before = e.hp;
    G.bullets.push({ x: G.player.x + 20, y: G.player.y, vx: 620, vy: 0, angle: 0, friendly: true, life: 1 });
    for (let i = 0; i < 30 && e.hp === before; i++) stepBullets(G, 0.05);
    assert(e.hp < before, 'bullet did not damage enemy');
    return `enemy hp ${before} -> ${e.hp}`;
  });

  check('gold bar payout', () => {
    const G = createGame(1);
    const g = G.world.goldSpots[0];
    const before = G.cash;
    G.player.x = g.x;
    G.player.y = g.y;
    stepGold(G);
    assert(g.taken === true, 'gold not collected');
    assert(G.cash === before + 150, `cash should be +150, got ${G.cash - before}`);
    return 'gold +$150';
  });

  check('shop sale', () => {
    const G = createGame(1);
    G.cash = 500;
    G.player.reserve = 0;
    const shop = G.world.shops[0];
    const ok = buyFromShop(G, shop, 'ammo');
    assert(ok === true, 'ammo purchase failed');
    assert(G.player.reserve === 60, 'reserve should be 60');
    assert(G.cash === 420, `cash should be 420, got ${G.cash}`);
    return 'ammo +60 for $80';
  });

  check('taxi pickup and dropoff', () => {
    const G = createGame(1);
    const car = G.world.parked[2].car;
    enterCar(G, car);
    startFare(G);
    assert(G.taxi.active === true, 'fare did not start');
    const before = G.cash;
    G.player.x = G.taxi.px;
    G.player.y = G.taxi.py;
    G.player.vehicle.x = G.taxi.px;
    G.player.vehicle.y = G.taxi.py;
    stepTaxi(G, 0.1);
    assert(G.taxi.phase === 'dropoff', 'pickup did not register');
    G.player.x = G.taxi.dx;
    G.player.y = G.taxi.dy;
    G.player.vehicle.x = G.taxi.dx;
    G.player.vehicle.y = G.taxi.dy;
    stepTaxi(G, 0.1);
    assert(G.taxi.active === false, 'dropoff did not complete');
    assert(G.cash > before, 'fare did not pay');
    return `fare paid, cash ${before} -> ${G.cash}`;
  });

  check('traffic sim 5s', () => {
    const G = createGame(1);
    for (let i = 0; i < 50; i++) stepTraffic(G, 0.1);
    for (const c of G.traffic) {
      assert(Number.isFinite(c.x) && Number.isFinite(c.y), 'traffic NaN');
      assert(c.x >= 0 && c.x <= G.world.W && c.y >= 0 && c.y <= G.world.H, 'traffic out of world');
    }
    return `${G.traffic.length} cars in bounds after 5s`;
  });

  check('busted costs 15 percent', () => {
    const G = createGame(1);
    G.screen = 'play';
    G.cash = 1000;
    G.cops.push({ x: G.player.x + 5, y: G.player.y, angle: 0, onFoot: true, car: null, hp: 60, cooldown: 5 });
    stepCops(G, 0.1);
    assert(G.screen === 'busted', `expected busted screen, got ${G.screen}`);
    assert(G.cash === 850, `cash should be 850 after bust, got ${G.cash}`);
    return 'busted, $1,000 -> $850';
  });

  check('save and load round-trip', () => {
    const G = createGame(1);
    G.cash = 777;
    G.debt = 5000;
    let available = true;
    try {
      if (!window.localStorage) available = false;
    } catch (err) {
      available = false;
    }
    if (!available) return 'localStorage unavailable here — skipped';
    const saved = saveGame(G);
    assert(saved === true, 'saveGame failed');
    const data = loadSave();
    assert(data && data.cash === 777 && data.debt === 5000, 'loaded save mismatch');
    return 'saved $777 / $5,000, loaded back';
  });

  check('render smoke test', () => {
    const G = createGame(1);
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    G.cam.x = 800;
    G.cam.y = 300;
    drawWorld(ctx, G);
    drawHUD(ctx, G);
    const px = ctx.getImageData(640, 360, 1, 1).data;
    assert(px[3] === 255, 'render produced a transparent frame');
    return 'world + HUD drew without error';
  });

  check('minimap draws', () => {
    const G = createGame(1);
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    drawMinimap(ctx, G);
    return 'minimap drew without error';
  });

  check('full 8-mission playthrough', () => {
    const G = createGame(1);
    G.screen = 'play';
    for (let job = 0; job < 8; job++) {
      startJob(G, job);
      let guard = 0;
      while (!G.jobDone[job] && guard++ < 400) {
        const step = G.story.active ? JOBS[job].steps[G.story.step] : null;
        if (!step) break;
        cheatStep(G, step);
        stepStory(G, 0.5);
        stepBullets(G, 0);
      }
      assert(G.jobDone[job] === true, `job ${job + 1} did not complete`);
    }
    assert(G.debt === 2050, `debt should be 2050, got ${G.debt}`);
    assert(G.cash === 8200, `cash should be 8200, got ${G.cash}`);
    assert(G.screen === 'win', `expected win screen, got ${G.screen}`);
    return '8/8 jobs, debt $10,000 -> $2,050, cash $250 -> $8,200';
  });

  check('state stays finite', () => {
    const G = createGame(1);
    assert(Number.isFinite(G.player.x) && Number.isFinite(G.player.y), 'player NaN');
    for (const c of G.traffic) assert(Number.isFinite(c.x), 'traffic NaN');
    return 'all positions finite';
  });

  check('job data complete', () => {
    assert(JOBS.length === 8, 'expected 8 jobs');
    const total = JOBS.reduce((s, j) => s + j.payout, 0);
    assert(total === 7950, `payouts should total 7950, got ${total}`);
    for (const j of JOBS) assert(j.steps.length >= 1, 'job with no steps');
    return '8 jobs, payouts total $7,950';
  });

  const passed = results.filter((r) => r.pass).length;
  return { results, passed, total: results.length };
}

// Drive one mission step the way a perfect player would, instantly:
// teleport to the target, clear the heat, drop the crew, run the fares.
function cheatStep(G, step) {
  const p = G.player;
  switch (step.kind) {
    case 'anycar': {
      if (!p.vehicle) enterCar(G, G.world.parked[2].car);
      break;
    }
    case 'goto':
    case 'timedgoto':
    case 'hold':
      p.x = step.x;
      p.y = step.y;
      if (p.vehicle) {
        p.vehicle.x = step.x;
        p.vehicle.y = step.y;
      }
      break;
    case 'collect': {
      const next = (G.story.stepState.spots || []).find((s) => !s.taken);
      if (next) {
        p.x = next.x;
        p.y = next.y;
      }
      break;
    }
    case 'stealtarget': {
      if (!p.vehicle || !p.vehicle.target) {
        const t = G.world.parked.find((pk) => pk.target);
        enterCar(G, t.car);
      }
      break;
    }
    case 'loseheat':
    case 'escape':
      G.heat = 0;
      G.wanted = 0;
      G.cops = [];
      break;
    case 'ambush':
      for (const e of G.enemies) {
        e.hp = 0;
        e.dead = true;
      }
      break;
    case 'taxi':
      if (G.story.onFareDone) G.story.onFareDone(G);
      break;
    default:
      break;
  }
}
