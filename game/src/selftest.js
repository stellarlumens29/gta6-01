// VELMARA — selftest.js: headless logic checks (?selftest=1). Runs the
// real game code: city gen, a scripted mission completion, the wanted
// system, stealing, combat, the economy, taxi fares, save/load, traffic
// and a render smoke test. No DOM assertions beyond the game itself.
import { buildCity, PLACES } from './city.js';
import { dist } from './util.js';

export function runSelfTests(game) {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });

  try {
    // 1. Deterministic city.
    const a = buildCity(1), b = buildCity(1);
    check('city-deterministic', a.buildings.length === b.buildings.length && a.buildings.length > 50
      && a.buildings[0].x === b.buildings[0].x && a.buildings[0].y === b.buildings[0].y,
      a.buildings.length + ' buildings');
    // 2. No building overlaps the canal water.
    const canalHit = a.buildings.some((bl) => bl.x < a.canal.x + a.canal.w && bl.x + bl.w > a.canal.x && bl.y < a.canal.h);
    check('city-no-building-in-canal', !canalHit, '');
    // 3. Mission 1 scripted completion: enter a car, drive to the Marina.
    const g = game;
    g.resetWorld(1);
    g.missions.start(0);
    const car = g.parkedCars[0];
    g.player.x = car.x; g.player.y = car.y;
    g.player.enterCar(car);
    g.missions.update(0.1);
    check('mission1-enter-car', !g.player.onFoot && g.missions.stepIndex === 1, 'step ' + g.missions.stepIndex);
    g.player.car.x = PLACES.marina.x; g.player.car.y = PLACES.marina.y;
    g.player.syncWithCar();
    g.missions.update(0.1);
    check('mission1-complete', g.missions.completedCount === 1 && g.player.cash >= 250 + 300, 'cash $' + g.player.cash);
    // 4. Wanted: crime raises stars, hiding cools them off.
    g.wanted.clear();
    const raised = g.wanted.addCrime(2, g.now);
    check('wanted-crime-raises', raised && g.wanted.stars === 2, g.wanted.stars + ' stars');
    let lost = 0;
    for (let i = 0; i < 40; i += 1) lost += g.wanted.update(1, 9999, 0);
    check('wanted-cools-off-unseen', lost >= 1 && g.wanted.stars < 2, 'lost ' + lost + ', now ' + g.wanted.stars);
    // 5. Stealing the target car (mission 4) flags it stolen.
    g.resetWorld(1);
    g.spawnTargetCar();
    const tc = g.targetCar;
    check('target-car-spawned', !!tc && tc.type === 'coupe', tc ? tc.color : 'none');
    g.player.x = tc.x; g.player.y = tc.y;
    g.stealCar();
    check('target-car-stolen', tc.stolen === true && !g.player.onFoot, '');
    // 6. Combat: a player bullet damages and can kill an enemy.
    g.resetWorld(1);
    g.spawnEnemies(g.player.x + 100, g.player.y, 1);
    const e = g.enemies[0];
    const hpBefore = e.hp;
    g.aimAngle = 0;
    g.fireBullet(true);
    for (let i = 0; i < 30; i += 1) g.updateBullets(1 / 30);
    check('combat-bullet-hits', e.hp < hpBefore || e.dead, 'hp ' + hpBefore + ' -> ' + e.hp);
    // 7. Economy: gold bar pickup pays, shop sells ammo.
    g.resetWorld(1);
    const bar = g.goldBars[0];
    const cashBefore = g.player.cash;
    g.player.x = bar.x; g.player.y = bar.y;
    g.updatePickups(0.1);
    check('gold-bar-pays', g.player.cash === cashBefore + 150 && bar.taken, 'cash $' + g.player.cash);
    g.player.cash = 500; g.player.ammo = 0;
    g.player.x = PLACES.gunshop.x; g.player.y = PLACES.gunshop.y;
    const msg = g.buyFromShop();
    check('shop-sells-ammo', g.player.ammo === 48 && g.player.cash === 450, msg);
    // 8. Taxi: a fare completes and pays.
    g.resetWorld(1);
    g.startTaxiRun(1);
    const t = g.taxi;
    g.player.enterCar(g.parkedCars[0]);
    g.player.car.x = t.pickup.x; g.player.car.y = t.pickup.y; g.player.syncWithCar();
    g.taxi.update(0.1, g.player, () => {}, (paid) => { g.player.addCash(paid); g.missions.onFareDone(); });
    check('taxi-pickup', t.phase === 'dropoff', t.phase);
    g.player.car.x = t.dropoff.x; g.player.car.y = t.dropoff.y; g.player.syncWithCar();
    const cash2 = g.player.cash;
    g.taxi.update(0.1, g.player, () => {}, (paid) => { g.player.addCash(paid); g.missions.onFareDone(); });
    check('taxi-dropoff-pays', g.player.cash > cash2 && t.faresDone === 1, 'paid $' + (g.player.cash - cash2));
    // 9. Traffic moves without NaN over 5 simulated seconds.
    g.resetWorld(1);
    for (let i = 0; i < 150; i += 1) g.updateTraffic(1 / 30);
    const bad = g.trafficCars.some((c) => Number.isNaN(c.x) || Number.isNaN(c.y));
    check('traffic-sim-5s', !bad && g.trafficCars.length >= 8, g.trafficCars.length + ' cars');
    // 10. Busted check: an officer on the player busts them.
    g.resetWorld(1);
    g.wanted.stars = 2;
    g.policeOfficers.push({ x: g.player.x, y: g.player.y, dead: false });
    check('busted-check', g.checkBustedNow(), '');
    // 11. Save / load round-trip.
    g.resetWorld(1);
    g.player.cash = 1234; g.missions.index = 2; g.debt = 8000;
    g.saveGame();
    const loaded = g.loadGameInto(new (Object.getPrototypeOf(g).constructor)(g.canvas, { headless: true }));
    check('save-load-roundtrip', !!loaded && loaded.cash === 1234, loaded ? 'cash $' + loaded.cash : 'no save');
    // 12. Render smoke test: one full world + HUD frame without throwing.
    try {
      g.render(0.5);
      check('render-smoke', true, '');
    } catch (err) {
      check('render-smoke', false, String(err && err.message));
    }
    // 13. Full story playthrough: drive every one of the 8 jobs to completion
    // with scripted inputs (teleports stand in for driving; the mission
    // runner, payouts, debt and win state are all exercised for real).
    try {
      g.resetWorld(1);
      g.missions = new (Object.getPrototypeOf(g.missions).constructor)(g);
      const cash0 = g.player.cash;
      let guard = 0;
      for (let mi = 0; mi < 8; mi += 1) {
        g.missions.start(mi);
        while (g.missions.active && guard < 600) {
          guard += 1;
          const step = g.missions.currentStep();
          const p = g.player;
          if (step.type === 'getInCar') {
            if (p.onFoot) {
              const car = g.parkedCars[0];
              p.x = car.x; p.y = car.y;
              p.enterCar(car);
            }
          } else if (step.type === 'getTargetCar') {
            if (!p.onFoot) p.exitCar();
            const tc = g.targetCar;
            p.x = tc.x; p.y = tc.y;
            g.stealCar();
          } else if (step.type === 'goto' || step.type === 'deliver') {
            if (p.car) { p.car.x = step.x; p.car.y = step.y; p.syncWithCar(); }
            else { p.x = step.x; p.y = step.y; }
          } else if (step.type === 'collect') {
            for (const d of g.cashDrops) {
              if (d.taken) continue;
              if (p.car) { p.car.x = d.x; p.car.y = d.y; p.syncWithCar(); }
              else { p.x = d.x; p.y = d.y; }
              g.updatePickups(0.1);
            }
          } else if (step.type === 'survive') {
            for (const e of g.enemies) {
              if (e.dead) continue;
              e.hp = 0; e.dead = true;
              g.missions.onEnemyKilled();
            }
          } else if (step.type === 'hold') {
            if (p.car) { p.car.x = step.x; p.car.y = step.y; p.syncWithCar(); }
            else { p.x = step.x; p.y = step.y; }
          } else if (step.type === 'escape') {
            g.wanted.stars = step.toStars || 0;
            if (step.gotoX !== undefined) {
              if (p.car) { p.car.x = step.gotoX; p.car.y = step.gotoY; p.syncWithCar(); }
              else { p.x = step.gotoX; p.y = step.gotoY; }
            }
          } else if (step.type === 'fares') {
            if (p.onFoot) {
              const car = g.parkedCars[0];
              p.x = car.x; p.y = car.y;
              p.enterCar(car);
            }
            const t = g.taxi;
            if (t.phase === 'pickup') {
              p.car.x = t.pickup.x; p.car.y = t.pickup.y; p.syncWithCar();
              g.taxi.update(0.1, p, () => {}, (paid) => { p.addCash(paid); g.missions.onFareDone(); });
            } else if (t.phase === 'dropoff') {
              p.car.x = t.dropoff.x; p.car.y = t.dropoff.y; p.syncWithCar();
              g.taxi.update(0.1, p, () => {}, (paid) => { p.addCash(paid); g.missions.onFareDone(); });
            }
          }
          g.missions.update(0.5);
          g.updatePickups(0.1);
        }
      }
      check('story-all-8-missions', g.missions.done && g.storyComplete && g.missions.completedCount === 8,
        'completed ' + g.missions.completedCount + '/8, debt $' + g.debt + ', cash $' + g.player.cash + ' (was $' + cash0 + ')');
    } catch (err) {
      check('story-all-8-missions', false, String(err && err.stack || err).slice(0, 300));
    }
  } catch (err) {
    results.push({ name: 'selftest-crashed', pass: false, detail: String(err && err.stack || err) });
  }
  return results;
}
