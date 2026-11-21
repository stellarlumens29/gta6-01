// VELMARA — main.js: the game. Boots the world, runs the loop, wires
// every system together: driving and stealing, traffic and pedestrians,
// the wanted system and the VPD, combat, 8 story jobs, the taxi trade,
// gold bars, shops, saving, menus and sound. Original city, story and art.
import { mulberry32, clamp, dist, randRange, randInt, pick, resolveCircleVsBoxes, angleDiff } from './util.js';
import { buildCity, PLACES, WORLD_W, WORLD_H, ROAD, COLS, ROWS, intersection, clampToWorld } from './city.js';
import { Player, nearestCar } from './player.js';
import { Car, spawnParkedCars, updateTrafficCar } from './vehicles.js';
import { spawnPeds, updatePeds } from './peds.js';
import { WantedSystem, maintainPolice, nearestPoliceDist, checkBusted, bustPenalty, respawnAfterBusted, respawnAfterWasted } from './police.js';
import { Bullet, Enemy, Particle, spawnBlood, spawnSparks, spawnSmoke, resolveBullets } from './combat.js';
import { MissionRunner, MISSIONS, STARTING_DEBT } from './missions.js';
import { spawnGoldBars, TaxiRun, shopAction, nearestShop, GOLD_BAR_VALUE } from './economy.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { drawWorld, drawMinimap, VIEW_W, VIEW_H } from './render.js';
import { drawHUD, drawTitle, drawHelp, drawPaused, drawBusted, drawWasted, drawWin, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_WIN, SCREEN_HELP } from './hud.js';
import { saveGame as persistSave, loadGame as readSave, hasSave } from './save.js';
import { applyShot } from './shots.js';
import { runSelfTests } from './selftest.js';

export class Game {
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = options || {};
    this.headless = !!this.opts.headless;
    this.seed = 1;
    this.rng = mulberry32(this.seed);
    this.audio = new AudioEngine();
    this.input = this.headless ? null : new Input(canvas);
    this.screen = SCREEN_TITLE;
    this.menuIndex = 0;
    this.now = 0;
    this.time = 0;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.messages = [];
    this.aimAngle = -Math.PI / 2;
    this.muzzleFlash = 0;
    this.shootCooldown = 0;
    this.wantedFlash = 0;
    this.lastPenalty = 0;
    this.carsStolen = 0;
    this.goldFound = 0;
    this.storyComplete = false;
    this.debt = STARTING_DEBT;
    this.hasSave = hasSave();
    this.saveData = readSave();
    this.scriptedDrive = null;
    this.scriptedShoot = false;
    this.lastTime = 0;
    this.danger = null;
    this.resetWorld(this.seed);
    this.missions = new MissionRunner(this);
    if (!this.headless) {
      canvas.addEventListener('click', (e) => this.onClick(e));
      window.addEventListener('keydown', (e) => this.onKey(e));
    }
  }

  resetWorld(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.city = buildCity(seed);
    this.places = PLACES;
    this.player = new Player(PLACES.safehouse.x, PLACES.safehouse.y + 40);
    this.wanted = new WantedSystem();
    this.parkedCars = spawnParkedCars(this.city, this.rng, 16);
    this.trafficCars = [];
    for (let i = 0; i < 10; i += 1) {
      const p = intersection(randInt(this.rng, 0, COLS - 1), randInt(this.rng, 0, ROWS - 1));
      const car = new Car(p.x, p.y, pick(this.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), pick(this.rng, ['sedan', 'taxi', 'van', 'truck', 'muscle']), this.rng);
      car.traffic = true;
      this.trafficCars.push(car);
    }
    this.policeCars = [];
    this.policeOfficers = [];
    this.peds = spawnPeds(this.rng, 26, this.city.colliders);
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.cashDrops = [];
    this.goldBars = spawnGoldBars(this.rng, this.city.colliders);
    this.taxi = new TaxiRun();
    this.targetCar = null;
    this.debt = STARTING_DEBT;
    this.carsStolen = 0;
    this.goldFound = 0;
    this.storyComplete = false;
    this.messages = [];
    this.now = 0;
    this.camera.x = clamp(this.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    this.camera.y = clamp(this.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  }

  /* ---------------------------- world hooks ---------------------------- */

  notify(text) {
    this.messages.push({ text, life: 5 });
    if (this.messages.length > 4) this.messages.shift();
  }
  spawnCashDrops(points) {
    this.cashDrops = points.map((p) => ({ x: p.x, y: p.y, taken: false }));
  }
  spawnEnemies(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      this.enemies.push(new Enemy(x + Math.cos(a) * 90, y + Math.sin(a) * 90, this.rng));
    }
    this.notify('Marlin crew — ' + n + ' shooters. Take them out!');
  }
  spawnTargetCar() {
    const car = new Car(1980, 396, 0, 'coupe', this.rng);
    car.color = '#ffd23f';
    this.targetCar = car;
    this.parkedCars.push(car);
  }
  startTaxiRun(count) {
    this.taxi.start(count, this.rng);
    this.notify('Taxi run — ' + count + ' fares. Pick them up in your car.');
  }

  /* ---------------------------- actions ---------------------------- */

  stealCar() {
    const p = this.player;
    const car = nearestCar(p.x, p.y, [...this.parkedCars, ...this.trafficCars], 64);
    if (!car) { this.notify('No car close enough.'); return false; }
    const wasParked = car.parked || car.traffic;
    p.enterCar(car);
    if (car === this.targetCar) car.stolen = true;
    if (wasParked) {
      this.carsStolen += 1;
      if (this.wanted.addCrime(1, this.now)) {
        this.wantedFlash = 1;
        this.audio.wantedUp();
        this.notify('Car stolen! The VPD noticed — wanted level up.');
      } else {
        this.notify('Stole a ' + car.name + '.');
      }
    }
    this.audio.horn();
    return true;
  }

  fireBullet(fromPlayer) {
    const p = this.player;
    if (fromPlayer) {
      if (p.ammo <= 0) { this.notify('Out of ammo — visit Marty\'s Guns & Meds.'); return false; }
      if (this.shootCooldown > 0) return false;
      this.shootCooldown = 0.18;
      p.ammo -= 1;
      const bx = p.x + Math.cos(this.aimAngle) * 22;
      const by = p.y + Math.sin(this.aimAngle) * 22;
      this.bullets.push(new Bullet(bx, by, this.aimAngle, 760, true, 34));
      this.muzzleFlash = 1;
      this.shake = Math.max(this.shake, 2);
      this.audio.gunshot();
      this.danger = { x: p.x, y: p.y };
      if (this.wanted.addCrime(1, this.now)) { this.wantedFlash = 1; this.audio.wantedUp(); }
      return true;
    }
    return false;
  }

  buyFromShop() {
    const kind = nearestShop(this.player);
    if (!kind) return 'No shop here.';
    const msg = shopAction(kind, this.player);
    this.audio.cash();
    this.notify(msg);
    return msg;
  }

  checkBustedNow() {
    return checkBusted(this.policeOfficers, this.player, this.wanted.stars);
  }

  /* ---------------------------- saving ---------------------------- */

  saveGame() {
    const p = this.player;
    const data = {
      version: 1, missionIndex: this.missions.index, completedCount: this.missions.completedCount,
      cash: p.cash, debt: this.debt, health: p.health, ammo: p.ammo, armor: p.armor,
      x: p.x, y: p.y, carsStolen: this.carsStolen, goldFound: this.goldFound,
      goldTaken: this.goldBars.map((g) => g.taken), now: this.now,
    };
    persistSave(data);
    this.hasSave = true;
    this.saveData = data;
    return data;
  }
  applySave(data) {
    const p = this.player;
    p.cash = data.cash; p.health = data.health; p.ammo = data.ammo; p.armor = data.armor || 0;
    p.x = data.x; p.y = data.y;
    this.debt = data.debt;
    this.missions.index = data.missionIndex;
    this.missions.completedCount = data.completedCount || 0;
    this.carsStolen = data.carsStolen || 0;
    this.goldFound = data.goldFound || 0;
    this.now = data.now || 0;
    if (Array.isArray(data.goldTaken)) {
      data.goldTaken.forEach((taken, i) => { if (taken && this.goldBars[i]) this.goldBars[i].taken = true; });
    }
    if (this.missions.index >= MISSIONS.length) this.storyComplete = true;
  }
  loadGameInto(other) {
    const data = readSave();
    if (!data) return null;
    other.applySave(data);
    return data;
  }

  /* ---------------------------- input ---------------------------- */

  onKey(e) {
    if (this.screen === SCREEN_TITLE) {
      if (e.key === 'ArrowDown' || e.key === 's') this.menuIndex = (this.menuIndex + 1) % 3;
      if (e.key === 'ArrowUp' || e.key === 'w') this.menuIndex = (this.menuIndex + 2) % 3;
      if (e.key === 'Enter') this.chooseMenu();
      return;
    }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
      if (this.screen === SCREEN_PLAY) this.screen = SCREEN_PAUSED;
      else if (this.screen === SCREEN_PAUSED) this.screen = SCREEN_PLAY;
      else if (this.screen === SCREEN_HELP) this.screen = SCREEN_TITLE;
      return;
    }
    if (this.screen === SCREEN_BUSTED || this.screen === SCREEN_WASTED) {
      if (e.key === 'Enter') this.screen = SCREEN_PLAY;
      return;
    }
    if (this.screen === SCREEN_WIN) {
      if (e.key === 'Enter') { this.screen = SCREEN_PLAY; this.missions.active = false; }
      return;
    }
    if (this.screen === SCREEN_PAUSED) {
      if (e.key === 's' || e.key === 'S') { this.saveGame(); this.notify('Saved.'); }
      if (e.key === 'q' || e.key === 'Q') { this.screen = SCREEN_TITLE; this.hasSave = hasSave(); this.saveData = readSave(); }
      return;
    }
  }

  onClick(e) {
    if (this.screen !== SCREEN_TITLE) return;
    const rect = this.canvas.getBoundingClientRect();
    const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    const idx = Math.floor((y - 378) / 46);
    if (idx >= 0 && idx <= 2) { this.menuIndex = idx; this.chooseMenu(); }
  }

  chooseMenu() {
    this.audio.ensure();
    if (this.menuIndex === 0) {
      if (this.hasSave && this.saveData) {
        this.resetWorld(this.seed);
        this.missions = new MissionRunner(this);
        this.applySave(this.saveData);
        this.notify('Welcome back, Mara. Debt: $' + this.debt + '.');
      } else {
        this.resetWorld(this.seed);
        this.missions = new MissionRunner(this);
        this.notify('Mara Voss — new in Velmara. Press M to start job 1.');
      }
      this.screen = SCREEN_PLAY;
    } else if (this.menuIndex === 1) {
      this.screen = SCREEN_HELP;
    } else {
      this.resetWorld(this.seed);
      this.missions = new MissionRunner(this);
      this.screen = SCREEN_PLAY;
      this.notify('Free roam — the city is yours. Press M whenever you want a job.');
    }
  }

  /* ---------------------------- update ---------------------------- */

  update(dt, scripted) {
    if (this.screen !== SCREEN_PLAY) return;
    dt = Math.min(dt, 0.05);
    this.now += dt;
    this.time += dt;
    const p = this.player;
    const input = this.input;
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 5);
    this.wantedFlash = Math.max(0, this.wantedFlash - dt * 0.8);
    this.shake = Math.max(0, this.shake - dt * 14);
    for (const m of this.messages) m.life -= dt;
    this.messages = this.messages.filter((m) => m.life > 0);

    // Aim: mouse in world space.
    if (input) {
      const wx = this.camera.x + input.mouse.x;
      const wy = this.camera.y + input.mouse.y;
      this.aimAngle = Math.atan2(wy - p.y, wx - p.x);
    }

    // Mission key.
    if (!scripted && input && input.wasPressed('m', 'M')) {
      if (!this.missions.active && !this.missions.done) {
        this.missions.start(this.missions.index);
        this.notify('JOB ' + (this.missions.index + 1) + ': ' + this.missions.current().title + ' — ' + this.missions.current().briefing);
      } else if (this.missions.failedReason) {
        this.missions.start(this.missions.index);
      }
    }
    if (!scripted && input && input.wasPressed('e', 'E')) {
      if (p.onFoot) {
        const shop = nearestShop(p);
        if (shop) this.buyFromShop();
        else this.stealCar();
      } else {
        const car = p.exitCar();
        if (car) car.parked = true;
      }
    }
    if (!scripted && input && input.wasPressed('h', 'H') && p.car) this.audio.horn();
    if (!scripted && input && input.wasPressed('n', 'N')) {
      this.audio.setMuted(!this.audio.muted);
      this.notify(this.audio.muted ? 'Sound off.' : 'Sound on.');
    }

    // Movement.
    if (p.onFoot) {
      const mv = input ? input.moveVector() : { x: 0, y: 0 };
      const sprint = input ? input.down('Shift') : false;
      p.moveOnFoot(mv.x, mv.y, sprint, dt, this.city.colliders);
      if (this.scriptedShoot) { this.scriptedShoot = false; this.fireBullet(true); }
      else if (!scripted && input && input.mouse.down) this.fireBullet(true);
    } else if (p.car) {
      let throttle = 0, steer = 0;
      if (this.scriptedDrive) { throttle = this.scriptedDrive.throttle; steer = this.scriptedDrive.steer; }
      else if (input) {
        if (input.down('w', 'ArrowUp')) throttle = 1;
        if (input.down('s', 'ArrowDown')) throttle = -1;
        if (input.down('a', 'ArrowLeft')) steer = -1;
        if (input.down('d', 'ArrowRight')) steer = 1;
      }
      const handbrake = input ? input.down(' ') : false;
      const car = p.car;
      const px = car.x, py = car.y;
      car.drive(throttle, steer, dt, handbrake);
      const pos = { x: car.x, y: car.y };
      if (resolveCircleVsBoxes(pos, 20, this.city.colliders)) {
        const impact = Math.abs(car.speed);
        car.x = pos.x; car.y = pos.y;
        if (impact > 120) {
          car.damage(Math.round(impact / 22));
          car.speed *= -0.25;
          this.shake = Math.max(this.shake, 5);
          this.audio.crash();
          spawnSparks(this.particles, car.x, car.y, 8);
        } else car.speed *= 0.5;
      }
      // Running over pedestrians is a crime.
      for (const ped of this.peds) {
        if (ped.dead) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 24 && Math.abs(car.speed) > 40) {
          ped.dead = true;
          spawnBlood(this.particles, ped.x, ped.y, 10);
          if (this.wanted.addCrime(1, this.now)) { this.wantedFlash = 1; this.audio.wantedUp(); this.notify('You hit a pedestrian! Wanted level up.'); }
        }
      }
      p.syncWithCar();
      void px; void py;
    }

    // Car-vs-car collisions (player car vs traffic / police).
    this.collideCars(dt);
    // Traffic + peds + police.
    this.updateTraffic(dt);
    updatePeds(this.peds, dt, this.city.colliders, this.danger, this.rng);
    this.danger = null;
    maintainPolice(this.policeCars, this.policeOfficers, this.wanted.stars, p, this.rng, dt, this.now);
    this.updatePoliceCollisions(dt);
    const nearestPD = nearestPoliceDist(this.policeCars, this.policeOfficers, p);
    this.wanted.update(dt, nearestPD, Math.abs(p.car ? p.car.speed : p.speed));
    if (this.checkBustedNow()) {
      this.lastPenalty = bustPenalty(p);
      this.wanted.clear();
      respawnAfterBusted(p);
      this.audio.busted();
      this.screen = SCREEN_BUSTED;
      return;
    }
    // Enemies.
    for (const e of this.enemies) e.update(dt, p, this.bullets, this.city.colliders);
    this.enemies = this.enemies.filter((e) => !e.dead);
    // Bullets.
    this.updateBullets(dt);
    // Pickups.
    this.updatePickups(dt);
    // Taxi.
    this.taxi.update(dt, p, () => this.notify('Fare picked up — drive to the marker.'), (paid) => {
      p.addCash(paid);
      this.audio.cash();
      this.missions.onFareDone();
      this.notify('Fare done — paid $' + paid + '.');
    });
    // Missions.
    this.missions.update(dt);
    if (this.storyComplete && this.screen === SCREEN_PLAY && !this.missions.active) {
      this.screen = SCREEN_WIN;
      this.audio.missionDone();
    }
    // Player regen + death.
    p.update(this.now, dt);
    if (p.dead) {
      this.lastPenalty = bustPenalty(p);
      this.wanted.clear();
      respawnAfterWasted(p);
      p.dead = false;
      this.audio.busted();
      this.screen = SCREEN_WASTED;
      return;
    }
    // Car destroyed under the player.
    if (p.car && p.car.dead) {
      spawnSmoke(this.particles, p.car.x, p.car.y, 10);
      this.audio.crash();
      p.exitCar();
      this.notify('Your car is wrecked!');
    }
    // Particles.
    for (const pt of this.particles) pt.update(dt);
    this.particles = this.particles.filter((pt) => pt.life > 0);
    // Camera follow.
    const tx = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
    const ty = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 6);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 6);
    // Audio.
    this.audio.setEngine(p.car ? Math.abs(p.car.speed) / p.car.topSpeed : 0, !!p.car);
    this.audio.setSiren(this.wanted.stars > 0);
    if (input) input.endFrame();
  }

  collideCars(dt) {
    const cars = [...this.trafficCars, ...this.policeCars, ...this.parkedCars];
    if (this.player.car) cars.push(this.player.car);
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (b.dead) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
          const closing = Math.abs(a.speed - b.speed);
          if (closing > 90) {
            a.damage(6); b.damage(6);
            if (a === this.player.car || b === this.player.car) {
              this.shake = Math.max(this.shake, 4);
              this.audio.crash();
              spawnSparks(this.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 6);
            }
          }
        }
      }
    }
    void dt;
  }

  updateTraffic(dt) {
    for (const c of this.trafficCars) {
      if (c.dead) continue;
      updateTrafficCar(c, dt, this.trafficCars, this.city.colliders, this.rng);
      const pos = { x: c.x, y: c.y };
      if (resolveCircleVsBoxes(pos, 20, this.city.colliders)) { c.x = pos.x; c.y = pos.y; c.speed *= 0.4; }
    }
    this.trafficCars = this.trafficCars.filter((c) => !c.dead);
    // Top the traffic back up.
    while (this.trafficCars.length < 10) {
      const p = intersection(randInt(this.rng, 0, COLS - 1), randInt(this.rng, 0, ROWS - 1));
      const car = new Car(p.x, p.y, pick(this.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), pick(this.rng, ['sedan', 'taxi', 'van', 'truck']), this.rng);
      car.traffic = true;
      this.trafficCars.push(car);
    }
    // Parked cars stay put; remove wrecked ones.
    this.parkedCars = this.parkedCars.filter((c) => !c.dead || c === this.targetCar);
  }

  updatePoliceCollisions(dt) {
    for (const car of this.policeCars) {
      if (car.dead) continue;
      const pos = { x: car.x, y: car.y };
      if (resolveCircleVsBoxes(pos, 20, this.city.colliders)) { car.x = pos.x; car.y = pos.y; car.speed *= 0.4; }
      // Ram the player: damage on contact.
      const p = this.player;
      if (p.car && dist(car.x, car.y, p.car.x, p.car.y) < 42) {
        p.car.damage(2);
        car.speed *= 0.7;
      } else if (p.onFoot && !p.dead && dist(car.x, car.y, p.x, p.y) < 30) {
        p.hurt(12, this.now);
        this.shake = Math.max(this.shake, 4);
      }
    }
    this.policeCars = this.policeCars.filter((c) => !c.dead);
    void dt;
  }

  updateBullets(dt) {
    for (const b of this.bullets) b.update(dt, this.city.colliders);
    resolveBullets(this.bullets, this.enemies, this.player, [...this.trafficCars, ...this.policeCars, ...this.parkedCars], this.peds, this.particles,
      (dmg) => { this.player.hurt(dmg, this.now); this.shake = Math.max(this.shake, 3); },
      (e) => {
        this.missions.onEnemyKilled();
        this.player.addCash(25);
        this.notify('Marlin crew down — looted $25.');
        void e;
      },
      (ped) => {
        if (this.wanted.addCrime(1, this.now)) { this.wantedFlash = 1; this.audio.wantedUp(); }
        void ped;
      });
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  updatePickups(dt) {
    const p = this.player;
    for (const d of this.cashDrops) {
      if (!d.taken && dist(p.x, p.y, d.x, d.y) < 34) {
        d.taken = true;
        p.addCash(100);
        this.audio.cash();
        this.missions.onCashCollected();
        this.notify('Cash stash — +$100.');
      }
    }
    for (const g of this.goldBars) {
      if (!g.taken && dist(p.x, p.y, g.x, g.y) < 30) {
        g.taken = true;
        this.goldFound += 1;
        p.addCash(GOLD_BAR_VALUE);
        this.audio.pickup();
        this.notify('Gold bar found! +$' + GOLD_BAR_VALUE + ' (' + this.goldFound + '/12).');
      }
    }
    void dt;
  }

  /* ---------------------------- render ---------------------------- */

  render(t) {
    const ctx = this.ctx;
    const cam = { x: this.camera.x, y: this.camera.y };
    if (this.shake > 0) {
      cam.x += randRange(Math.random, -this.shake, this.shake);
      cam.y += randRange(Math.random, -this.shake, this.shake);
    }
    if (this.screen === SCREEN_TITLE) { drawTitle(ctx, this); return; }
    if (this.screen === SCREEN_HELP) { drawHelp(ctx, this); return; }
    drawWorld(ctx, this, cam, t);
    if (this.screen === SCREEN_PLAY) drawHUD(ctx, this);
    if (this.screen === SCREEN_PAUSED) drawPaused(ctx, this);
    if (this.screen === SCREEN_BUSTED) drawBusted(ctx, this);
    if (this.screen === SCREEN_WASTED) drawWasted(ctx, this);
    if (this.screen === SCREEN_WIN) drawWin(ctx, this);
  }

  start() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    const selftest = params.get('selftest');
    if (selftest === '1') {
      this.screen = SCREEN_PLAY;
      const results = runSelfTests(this);
      const passed = results.filter((r) => r.pass).length;
      document.title = 'SELFTEST ' + passed + '/' + results.length;
      const pre = document.createElement('pre');
      pre.id = 'selftest';
      pre.textContent = JSON.stringify(results, null, 2);
      document.body.appendChild(pre);
      window.__selftest = { passed, total: results.length, results };
      console.log('SELFTEST ' + passed + '/' + results.length);
      this.render(0.5);
      return;
    }
    if (shot) {
      const seed = Number(params.get('seed') || '1');
      this.resetWorld(seed);
      this.missions = new MissionRunner(this);
      applyShot(this, shot);
      this.render(this.time + 0.5);
      window.__ready = true;
      document.title = 'SHOT ' + shot;
      return;
    }
    const loop = (ts) => {
      const dt = this.lastTime ? (ts - this.lastTime) / 1000 : 0.016;
      this.lastTime = ts;
      if (this.screen === SCREEN_PLAY || this.screen === SCREEN_PAUSED) this.update(dt, false);
      else this.time += dt;
      if (this.input) this.input.endFrame();
      this.render(this.time);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas, {});
window.__game = game;
game.start();
