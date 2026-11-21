// VELMARA — shots.js: deterministic screenshot scenes. Each scene sets up
// real game state (a mission in progress, a police chase, a shootout) and
// then plays it forward a fixed number of steps with scripted inputs, so
// the frame is what short real play looks like — the same seed always
// gives the same frame. ?shot=title|drive|chase|mission&seed=1
import { PLACES, intersection } from './city.js';
import { Car } from './vehicles.js';

const STEP = 1 / 30;

function stepGame(game, n, input) {
  for (let i = 0; i < n; i += 1) {
    if (input) input(game, i);
    game.update(STEP, true);
  }
}

export function applyShot(game, name) {
  const p = game.player;
  if (name === 'title') {
    game.screen = 'title';
    game.menuIndex = 0;
    return;
  }
  game.screen = 'play';
  if (name === 'drive') {
    // Mission 1 in progress: Mara in a coupe on the Neon Strip, traffic
    // around, objective beacon at the Marina, golden hour.
    game.missions.start(0);
    const car = new Car(1980, 396, 0, 'coupe', game.rng);
    car.color = '#ffd23f';
    game.parkedCars.push(car);
    p.x = 1980; p.y = 396;
    p.enterCar(car);
    game.camera.x = p.x - 640; game.camera.y = p.y - 360;
    stepGame(game, 50, (g) => { g.scriptedDrive = { throttle: 1, steer: 0 }; });
    game.scriptedDrive = null;
    return;
  }
  if (name === 'chase') {
    // 3-star chase: Mara fleeing down the Marina road, two VPD interceptors
    // on her tail, sirens up, minimap lit with blue dots.
    game.missions.start(3);
    const car = new Car(1476, 1000, -Math.PI / 2, 'muscle', game.rng);
    car.color = '#c94f43';
    game.parkedCars.push(car);
    p.x = 1476; p.y = 1000;
    p.enterCar(car);
    game.wanted.stars = 3;
    const c1 = new Car(1476, 1180, -Math.PI / 2, 'police', game.rng);
    const c2 = new Car(1420, 1240, -Math.PI / 2, 'police', game.rng);
    game.policeCars.push(c1, c2);
    game.camera.x = p.x - 640; game.camera.y = p.y - 360;
    stepGame(game, 70, (g) => { g.scriptedDrive = { throttle: 1, steer: 0.12 }; });
    game.scriptedDrive = null;
    return;
  }
  if (name === 'mission') {
    // Dockside ambush: on foot, pistol out, Marlin crew shooting, the
    // objective beacon over the yard, 2 wanted stars.
    game.missions.start(4);
    game.missions.stepIndex = 1;
    game.missions.beginStep();
    p.x = PLACES.docks.x - 120; p.y = PLACES.docks.y - 60;
    p.angle = 0;
    game.wanted.stars = 2;
    game.aimAngle = Math.atan2(PLACES.docks.y - p.y, PLACES.docks.x - p.x);
    game.camera.x = p.x - 640; game.camera.y = p.y - 360;
    stepGame(game, 45, (g, i) => {
      if (i % 10 === 0) g.scriptedShoot = true;
    });
    game.scriptedShoot = false;
    return;
  }
  // Unknown shot: plain free-roam play frame.
  game.screen = 'play';
  stepGame(game, 30, null);
}

export function shotNames() { return ['title', 'drive', 'chase', 'mission']; }
