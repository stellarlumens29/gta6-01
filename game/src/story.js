// story.js — the 8-job story: Mara Voss owes fixer Tio Anselmo $10,000.
// Each job is data (steps with a kind), and one small runner ticks the
// active step. The HUD reads objectiveText(); the self-test drives the
// same runner with scripted positions, so a green playthrough is real.

import { dist, makeRng } from './rng.js';
import { spawnEnemy } from './fight.js';
import { startFare } from './side.js';

export const DEBT_START = 10000;

export const JOBS = [
  {
    name: 'First Wheels',
    brief: 'Tio Anselmo: "You owe me ten grand, Mara. Start with wheels — steal any car and bring it to the Marina."',
    payout: 300,
    steps: [
      { kind: 'anycar', label: 'Steal any car (E)' },
      { kind: 'goto', x: 1710, y: 1370, r: 110, label: 'Drive to the Marina' },
    ],
  },
  {
    name: 'The Courier',
    brief: 'A package waits at Plaza del Sol. The buyer is at the docks, and he does not wait.',
    payout: 450,
    steps: [
      { kind: 'goto', x: 1110, y: 720, r: 80, label: 'Pick up at Plaza del Sol' },
      { kind: 'timedgoto', x: 2560, y: 1300, r: 100, t: 100, label: 'Deliver to the docks' },
    ],
  },
  {
    name: 'Cash Run',
    brief: 'Five stashes are hidden around Old Town from the old crew. Collect them all before the Marlin crew does.',
    payout: 500,
    steps: [{ kind: 'collect', n: 5, label: 'Collect 5 stashes around Old Town' }],
  },
  {
    name: 'Hot Wheels',
    brief: 'A yellow Veloce GT is parked on the Neon Strip. Take it — then lose the heat before you bring it home.',
    payout: 700,
    steps: [
      { kind: 'stealtarget', label: 'Steal the yellow Veloce GT' },
      { kind: 'loseheat', label: 'Lose the heat (0 stars)' },
    ],
  },
  {
    name: 'Dockside Deal',
    brief: 'Meet the buyer at the docks. Word is the Marlin crew plans to crash the deal.',
    payout: 900,
    steps: [
      { kind: 'goto', x: 2560, y: 1300, r: 90, label: 'Meet the buyer at the docks' },
      { kind: 'ambush', n: 4, label: 'Survive the ambush' },
      { kind: 'goto', x: 1080, y: 760, r: 90, label: 'Get home safe' },
    ],
  },
  {
    name: 'Taxi Nights',
    brief: 'Honest money, for once. Three fares before the night is over — the meter is running.',
    payout: 800,
    steps: [{ kind: 'taxi', n: 3, label: 'Run 3 taxi fares' }],
  },
  {
    name: 'The Vault Job',
    brief: 'The bank on Canal Row. Hold the vault for 25 seconds under the alarm, then slip away quiet.',
    payout: 1800,
    steps: [
      { kind: 'goto', x: 1120, y: 300, r: 90, label: 'Reach the bank vault' },
      { kind: 'hold', x: 1120, y: 300, r: 90, t: 25, label: 'Hold the vault (25s)' },
      { kind: 'escape', label: 'Escape at 1 star or less' },
    ],
  },
  {
    name: 'King of Velmara',
    brief: 'The Marlin crew ends tonight. Take the docks, take the yacht, take the city.',
    payout: 2500,
    steps: [
      { kind: 'goto', x: 2560, y: 1300, r: 100, label: 'Go to the docks' },
      { kind: 'ambush', n: 6, label: 'Take down the Marlin crew' },
      { kind: 'goto', x: 1720, y: 1380, r: 110, label: 'Take the yacht' },
    ],
  },
];

export function newStory() {
  return {
    job: -1,
    step: 0,
    active: false,
    stepState: {},
    faresDone: 0,
    onFareDone: null,
    failed: null,
  };
}

export function currentJob(G) {
  if (!G.story.active || G.story.job < 0) return null;
  return JOBS[G.story.job];
}

export function currentStep(G) {
  const job = currentJob(G);
  if (!job) return null;
  return job.steps[G.story.step] || null;
}

export function startJob(G, i) {
  const job = JOBS[i];
  if (!job) return false;
  G.story.job = i;
  G.story.step = 0;
  G.story.active = true;
  G.story.failed = null;
  G.story.faresDone = 0;
  G.story.onFareDone = null;
  G.enemies = [];
  initStep(G);
  G.banner(`Job ${i + 1}: ${job.name}`, job.brief);
  G.sound.sting(true);
  return true;
}

function initStep(G) {
  const step = currentStep(G);
  if (!step) return;
  const st = (G.story.stepState = {});
  const p = G.player;
  if (step.kind === 'collect') {
    const rng = makeRng(G.seed + 500 + G.story.job);
    st.spots = [];
    for (let n = 0; n < step.n; n++) {
      st.spots.push({ x: rng.range(150, 1050), y: rng.range(150, 900), taken: false });
    }
    st.count = 0;
  }
  if (step.kind === 'ambush') {
    st.spawned = 0;
    for (let n = 0; n < step.n; n++) {
      const a = (n / step.n) * Math.PI * 2;
      spawnEnemy(G, p.x + Math.cos(a) * 260, p.y + Math.sin(a) * 260, 60);
      st.spawned++;
    }
    G.msg('ambush — the Marlin crew is here');
  }
  if (step.kind === 'taxi') {
    G.story.faresDone = 0;
    G.story.onFareDone = () => {
      G.story.faresDone += 1;
      if (G.story.faresDone < step.n) startFare(G);
    };
    startFare(G);
  }
  if (step.kind === 'timedgoto') st.timeLeft = step.t;
  if (step.kind === 'hold') {
    st.held = 0;
    st.alarmed = false;
  }
}

function advanceStep(G) {
  G.story.step += 1;
  const job = currentJob(G);
  if (!job) return;
  if (G.story.step >= job.steps.length) {
    finishJob(G, job);
  } else {
    initStep(G);
    G.sound.pickup();
  }
}

function finishJob(G, job) {
  const i = G.story.job;
  G.jobDone[i] = true;
  G.addCash(job.payout, `job ${i + 1}`);
  G.debt = Math.max(0, G.debt - job.payout);
  G.story.active = false;
  G.story.job = -1;
  G.story.onFareDone = null;
  G.banner('Job complete', `${job.name} — $${job.payout} toward the debt`);
  G.sound.sting(true);
  G.saveGame();
  if (G.jobDone.every(Boolean)) {
    G.win();
  } else {
    G.jobIndex = Math.min(G.jobDone.findIndex((d) => !d), JOBS.length - 1);
  }
}

function failStep(G, reason) {
  G.story.failed = reason;
  G.banner('Job failed', reason + ' — press M to retry');
  G.sound.sting(false);
  const i = G.story.job;
  G.story.active = false;
  G.story.job = -1;
  G.story.onFareDone = null;
  G.jobIndex = i;
}

export function stepStory(G, dt) {
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;
  const st = G.story.stepState;

  switch (step.kind) {
    case 'anycar':
      if (p.vehicle) advanceStep(G);
      break;
    case 'goto':
      if (dist(p.x, p.y, step.x, step.y) < step.r) advanceStep(G);
      break;
    case 'timedgoto':
      st.timeLeft -= dt;
      if (dist(p.x, p.y, step.x, step.y) < step.r) advanceStep(G);
      else if (st.timeLeft <= 0) failStep(G, 'Too slow — the buyer walked');
      break;
    case 'collect': {
      for (const s of st.spots) {
        if (!s.taken && dist(p.x, p.y, s.x, s.y) < 44) {
          s.taken = true;
          st.count += 1;
          G.sound.pickup();
          G.msg(`stash ${st.count}/${step.n}`);
        }
      }
      if (st.count >= step.n) advanceStep(G);
      break;
    }
    case 'stealtarget':
      if (p.vehicle && p.vehicle.target) advanceStep(G);
      break;
    case 'loseheat':
      if (G.wanted === 0) advanceStep(G);
      break;
    case 'ambush':
      if (G.enemies.length === 0) advanceStep(G);
      break;
    case 'taxi':
      if (G.story.faresDone >= step.n) advanceStep(G);
      break;
    case 'hold': {
      const inside = dist(p.x, p.y, step.x, step.y) < step.r;
      if (inside) {
        if (!st.alarmed) {
          st.alarmed = true;
          G.addHeat(2, 'vault alarm');
          G.msg('alarm tripped — hold the vault');
        }
        st.held += dt;
        if (st.held >= step.t) advanceStep(G);
      } else if (st.held > 0) {
        st.held = Math.max(0, st.held - dt * 2);
      }
      break;
    }
    case 'escape':
      if (G.wanted <= 1) advanceStep(G);
      break;
    default:
      break;
  }
}

// Where the HUD should point: the active step's target, if it has one.
export function objectiveTarget(G) {
  const step = currentStep(G);
  if (!step) return null;
  if (step.kind === 'goto' || step.kind === 'timedgoto' || step.kind === 'hold') {
    return { x: step.x, y: step.y, label: step.label };
  }
  if (step.kind === 'collect') {
    const next = (G.story.stepState.spots || []).find((s) => !s.taken);
    if (next) return { x: next.x, y: next.y, label: step.label };
  }
  if (step.kind === 'taxi' && G.taxi && G.taxi.active) {
    const t = G.taxi;
    return t.phase === 'pickup'
      ? { x: t.px, y: t.py, label: 'Pick up the rider' }
      : { x: t.dx, y: t.dy, label: 'Drop off the rider' };
  }
  if (step.kind === 'ambush' && G.enemies.length > 0) {
    return { x: G.enemies[0].x, y: G.enemies[0].y, label: step.label };
  }
  return null;
}

export function objectiveText(G) {
  const job = currentJob(G);
  if (!job) {
    if (G.jobDone.every(Boolean)) return 'Velmara is yours — free roam';
    return `Press M to start Job ${G.jobIndex + 1}: ${JOBS[G.jobIndex].name}`;
  }
  const step = currentStep(G);
  if (!step) return job.name;
  let extra = '';
  if (step.kind === 'timedgoto') extra = ` — ${Math.ceil(G.story.stepState.timeLeft)}s`;
  if (step.kind === 'hold') extra = ` — ${Math.ceil(step.t - G.story.stepState.held)}s`;
  if (step.kind === 'collect') extra = ` — ${G.story.stepState.count || 0}/${step.n}`;
  if (step.kind === 'taxi') extra = ` — ${G.story.faresDone}/${step.n}`;
  if (step.kind === 'ambush') extra = ` — ${G.enemies.length} left`;
  return `Job ${G.story.job + 1}: ${job.name} — ${step.label}${extra}`;
}
