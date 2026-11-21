// VELMARA — missions.js: the story. Mara Voss, wheelwoman new to Velmara,
// owes fixer Tio Anselmo $10,000. Eight story jobs pay the debt down —
// steal, courier, collect, escape, ambush, taxi nights, a bank job, and a
// final shootout at the docks. Each step is one objective type the runner
// understands: goto, getInCar, deliver, collect, escape, survive, hold,
// fares. Side content (gold bars, taxi fares) lives in economy.js.
import { PLACES } from './city.js';
import { dist } from './util.js';

export const STARTING_DEBT = 10000;

export const MISSIONS = [
  {
    id: 'first-wheels', title: 'First Wheels', payout: 300,
    briefing: 'TIO: "Welcome to Velmara, Mara. Debt is $10,000. First job is easy — take any car and bring it to the Marina. Don\'t get cute."',
    steps: [
      { type: 'getInCar', label: 'Steal any car (walk up and press E)' },
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Drive to the Marina', radius: 90 },
    ],
  },
  {
    id: 'courier', title: 'The Courier', payout: 450,
    briefing: 'TIO: "A package is waiting at Plaza del Sol. Portside Docks want it in 100 seconds. Drive like the rent is due — it is."',
    steps: [
      { type: 'goto', x: PLACES.plaza.x, y: PLACES.plaza.y, label: 'Pick up the package at Plaza del Sol', radius: 70 },
      { type: 'deliver', x: PLACES.port.x, y: PLACES.port.y, label: 'Deliver to Portside Docks', radius: 80, time: 100 },
    ],
  },
  {
    id: 'cash-run', title: 'Cash Run', payout: 500,
    briefing: 'TIO: "Five stashes hidden around Old Town. My old crew left them before the PD swept the block. Walk or drive — just bring them all back."',
    steps: [
      {
        type: 'collect', label: 'Collect all 5 cash stashes in Old Town',
        points: [
          { x: 200, y: 200 }, { x: 900, y: 120 }, { x: 500, y: 560 },
          { x: 150, y: 620 }, { x: 950, y: 620 },
        ],
      },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', payout: 700,
    briefing: 'TIO: "A yellow Veloce GT sits on the Neon Strip. It belongs to the Marlin crew. Take it — and lose the heat before you bring it home."',
    steps: [
      { type: 'getTargetCar', label: 'Steal the yellow Veloce GT on the Neon Strip' },
      { type: 'escape', label: 'Lose the wanted level (stay out of sight)', toStars: 0 },
    ],
  },
  {
    id: 'dockside', title: 'Dockside Deal', payout: 900,
    briefing: 'TIO: "Meet my buyer at the Container Yard. Word is the Marlin crew crashed the deal. If lead starts flying, finish it — then come home."',
    steps: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Meet the buyer at the Container Yard', radius: 80 },
      { type: 'survive', label: 'Ambush! Take out the Marlin crew', count: 4, spawnAt: { x: PLACES.docks.x, y: PLACES.docks.y } },
      { type: 'goto', x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'Get back to the Safehouse', radius: 80 },
    ],
  },
  {
    id: 'taxi-nights', title: 'Taxi Nights', payout: 800,
    briefing: 'TIO: "Slow night. The city still pays — three fares, four minutes, any car. Smile, Mara. Tips are real money."',
    steps: [
      { type: 'fares', label: 'Complete 3 taxi fares', count: 3, time: 240 },
    ],
  },
  {
    id: 'vault', title: 'The Vault Job', payout: 1800,
    briefing: 'TIO: "The big one. Velmara Reserve Bank, 25 seconds on the vault door. The alarm will scream and the whole VPD will come. Then run."',
    steps: [
      { type: 'goto', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Reach the Velmara Reserve Bank', radius: 80 },
      { type: 'hold', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Hold the vault — stay by the bank!', radius: 110, time: 25 },
      { type: 'escape', label: 'Escape to the Safehouse with the heat at 1 star or less', toStars: 1, gotoX: PLACES.safehouse.x, gotoY: PLACES.safehouse.y },
    ],
  },
  {
    id: 'king', title: 'King of Velmara', payout: 2500,
    briefing: 'TIO: "Last job. The Marlin crew\'s boss is at the Portside Docks with six shooters. End it, take the yacht at the Marina, and the debt is gone. Velmara is yours."',
    steps: [
      { type: 'goto', x: PLACES.port.x, y: PLACES.port.y, label: 'Reach the Portside Docks', radius: 90 },
      { type: 'survive', label: 'Take out the Marlin crew (6)', count: 6, spawnAt: { x: PLACES.port.x, y: PLACES.port.y } },
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Take the yacht at the Marina', radius: 90 },
    ],
  },
];

export class MissionRunner {
  constructor(world) {
    this.w = world;
    this.index = 0;
    this.stepIndex = 0;
    this.active = false;
    this.completedCount = 0;
    this.stepTimer = 0;
    this.stepData = null;
    this.failedReason = '';
    this.banner = '';
    this.bannerTimer = 0;
  }

  current() { return MISSIONS[this.index] || null; }
  currentStep() {
    const m = this.current();
    return m ? m.steps[this.stepIndex] : null;
  }
  get done() { return this.index >= MISSIONS.length; }

  start(index) {
    this.index = index;
    this.stepIndex = 0;
    this.active = true;
    this.stepTimer = 0;
    this.stepData = null;
    this.failedReason = '';
    this.beginStep();
    this.w.audio.missionStart();
  }

  beginStep() {
    const step = this.currentStep();
    if (!step) return;
    this.stepTimer = step.time || 0;
    this.stepData = { collected: 0, kills: 0, fares: 0, holdTime: 0, spawned: false };
    if (step.type === 'collect') {
      this.w.spawnCashDrops(step.points);
    }
    if (step.type === 'survive') {
      this.w.spawnEnemies(step.spawnAt.x, step.spawnAt.y, step.count);
      this.stepData.spawned = true;
    }
    if (step.type === 'hold') {
      this.w.wanted.addCrime(2, this.w.now);
      this.w.audio.wantedUp();
    }
    if (step.type === 'fares') {
      this.w.startTaxiRun(step.count);
    }
    if (step.type === 'getTargetCar') {
      this.w.spawnTargetCar();
    }
  }

  objectiveText() {
    if (!this.active) return this.done ? 'Story complete — Velmara is yours.' : 'Press M to start the next job.';
    const m = this.current();
    const step = this.currentStep();
    if (!m || !step) return '';
    let text = (this.stepIndex + 1) + '/' + m.steps.length + ' — ' + step.label;
    if (step.type === 'collect') text += ' (' + this.stepData.collected + '/' + step.points.length + ')';
    if (step.type === 'survive') text += ' (' + this.stepData.kills + '/' + step.count + ')';
    if (step.type === 'fares') text += ' (' + this.stepData.fares + '/' + step.count + ')';
    if (step.type === 'hold') text += ' (' + Math.ceil(this.stepData.holdTime) + '/' + step.time + 's)';
    if (this.stepTimer > 0 && (step.type === 'deliver' || step.type === 'fares')) text += ' — ' + Math.ceil(this.stepTimer) + 's left';
    return text;
  }

  /** Map marker for the current objective, or null. */
  target() {
    if (!this.active) return null;
    const step = this.currentStep();
    if (!step) return null;
    if (step.type === 'goto' || step.type === 'deliver' || step.type === 'hold') return { x: step.x, y: step.y, label: step.label };
    if (step.type === 'survive') return { x: step.spawnAt.x, y: step.spawnAt.y, label: step.label };
    if (step.type === 'collect') {
      const drops = this.w.cashDrops.filter((d) => !d.taken);
      if (drops.length) return { x: drops[0].x, y: drops[0].y, label: step.label };
      return null;
    }
    if (step.type === 'fares') {
      const t = this.w.taxi;
      if (t && t.phase === 'pickup') return { x: t.pickup.x, y: t.pickup.y, label: 'Pick up the fare' };
      if (t && t.phase === 'dropoff') return { x: t.dropoff.x, y: t.dropoff.y, label: 'Drop off the fare' };
      return null;
    }
    if (step.type === 'escape' && step.gotoX !== undefined) return { x: step.gotoX, y: step.gotoY, label: step.label };
    if (step.type === 'getTargetCar') {
      const c = this.w.targetCar;
      if (c && !c.stolen) return { x: c.x, y: c.y, label: step.label };
      return null;
    }
    return null;
  }

  onCashCollected() {
    const step = this.currentStep();
    if (this.active && step && step.type === 'collect') this.stepData.collected += 1;
  }
  onEnemyKilled() {
    const step = this.currentStep();
    if (this.active && step && step.type === 'survive') this.stepData.kills += 1;
  }
  onFareDone() {
    const step = this.currentStep();
    if (this.active && step && step.type === 'fares') this.stepData.fares += 1;
  }

  fail(reason) {
    this.active = false;
    this.failedReason = reason;
    this.w.audio.busted();
    this.w.notify('JOB FAILED — ' + reason + ' — press M to retry');
  }

  completeMission() {
    const m = this.current();
    this.w.player.addCash(m.payout);
    this.w.debt = Math.max(0, this.w.debt - m.payout);
    this.completedCount += 1;
    this.active = false;
    this.banner = 'JOB DONE — ' + m.title + '  +' + '$' + m.payout;
    this.bannerTimer = 4;
    this.w.audio.missionDone();
    this.w.saveGame();
    if (this.index + 1 >= MISSIONS.length) {
      this.index = MISSIONS.length;
      this.w.storyComplete = true;
    } else {
      this.index += 1;
    }
  }

  advanceStep() {
    const m = this.current();
    this.stepIndex += 1;
    if (this.stepIndex >= m.steps.length) this.completeMission();
    else this.beginStep();
  }

  update(dt) {
    if (this.bannerTimer > 0) this.bannerTimer -= dt;
    if (!this.active) return;
    const w = this.w;
    const step = this.currentStep();
    if (!step) return;
    const p = w.player;
    if (step.type === 'deliver' || step.type === 'fares') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.fail('Out of time.'); return; }
    }
    if (step.type === 'getInCar') {
      if (!p.onFoot) this.advanceStep();
      return;
    }
    if (step.type === 'getTargetCar') {
      if (w.targetCar && w.targetCar.stolen) {
        w.wanted.addCrime(2, w.now);
        w.audio.wantedUp();
        this.advanceStep();
      }
      return;
    }
    if (step.type === 'goto' || step.type === 'deliver') {
      if (dist(p.x, p.y, step.x, step.y) < (step.radius || 80)) this.advanceStep();
      return;
    }
    if (step.type === 'collect') {
      if (this.stepData.collected >= step.points.length) this.advanceStep();
      return;
    }
    if (step.type === 'survive') {
      if (this.stepData.kills >= step.count) this.advanceStep();
      return;
    }
    if (step.type === 'hold') {
      if (dist(p.x, p.y, step.x, step.y) < (step.radius || 110)) {
        this.stepData.holdTime += dt;
        if (this.stepData.holdTime >= step.time) this.advanceStep();
      }
      return;
    }
    if (step.type === 'fares') {
      if (this.stepData.fares >= step.count) this.advanceStep();
      return;
    }
    if (step.type === 'escape') {
      if (w.wanted.stars <= (step.toStars || 0)) {
        if (step.gotoX !== undefined) {
          if (dist(p.x, p.y, step.gotoX, step.gotoY) < 90) this.advanceStep();
        } else this.advanceStep();
      }
      return;
    }
  }
}
