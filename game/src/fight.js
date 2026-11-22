// fight.js — combat: the pistol, tracers, muzzle flash, rival crews who
// strafe and shoot back, and the particle bursts everything makes.
// Enemies are plain state; the runner in story.js spawns them per job.

import { clamp, dist, angleTo, turnToward, circleRectResolve } from './rng.js';
import { burst } from './traffic.js';

export function spawnEnemy(G, x, y, hp) {
  const e = {
    x,
    y,
    angle: 0,
    hp: hp || 60,
    maxHp: hp || 60,
    cooldown: 1 + Math.random() * 1.5,
    strafe: Math.random() < 0.5 ? 1 : -1,
    strafeT: 0,
    dead: false,
  };
  G.enemies.push(e);
  return e;
}

export function fireBullet(G, x, y, angle, friendly, speed) {
  G.bullets.push({
    x,
    y,
    vx: Math.cos(angle) * (speed || 620),
    vy: Math.sin(angle) * (speed || 620),
    angle,
    friendly: !!friendly,
    life: 1.1,
  });
  G.recentShot = 0.6;
}

// The player's shot: costs ammo, makes noise, makes heat.
export function playerShoot(G, wx, wy) {
  const p = G.player;
  if (p.ammo <= 0) {
    G.sound.click();
    G.msg('no ammo — visit Marty’s');
    return false;
  }
  p.ammo -= 1;
  const a = angleTo(p.x, p.y, wx, wy);
  p.angle = a;
  const mx = p.x + Math.cos(a) * 26;
  const my = p.y + Math.sin(a) * 26;
  fireBullet(G, mx, my, a, true);
  burst(G, mx, my, '#ffd23e', 4);
  G.sound.shot();
  G.cam.shake = Math.min(6, G.cam.shake + 1.5);
  G.addHeat(0.25, 'gunfire');
  return true;
}

export function stepBullets(G, dt) {
  const w = G.world;
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > w.W || b.y > w.H;
    if (!dead) {
      for (const bd of w.buildings) {
        if (b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.d) {
          burst(G, b.x, b.y, '#c9c9c9', 3);
          dead = true;
          break;
        }
      }
    }
    if (dead) {
      b.dead = true;
      continue;
    }
    if (b.friendly) {
      for (const e of G.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < 20) {
          e.hp -= 34;
          burst(G, b.x, b.y, '#ff5d5d', 6);
          if (e.hp <= 0) {
            e.dead = true;
            G.stats.kills += 1;
            G.addCash(40, 'loot');
            burst(G, e.x, e.y, '#ff5d5d', 16);
            G.addHeat(0.5, 'rival down');
          }
          b.dead = true;
          break;
        }
      }
      for (const c of G.cops) {
        if (c.dead || c.onFoot === false) continue;
        if (dist(b.x, b.y, c.x, c.y) < 20) {
          c.hp -= 34;
          burst(G, b.x, b.y, '#9db8d6', 6);
          if (c.hp <= 0) {
            c.dead = true;
            G.stats.kills += 1;
            G.addHeat(1, 'officer down');
          }
          b.dead = true;
          break;
        }
      }
    } else {
      const p = G.player;
      const pr = p.onFoot ? 18 : 26;
      if (dist(b.x, b.y, p.x, p.y) < pr) {
        hurtPlayer(G, 7 + Math.random() * 6);
        burst(G, b.x, b.y, '#ff8a8a', 5);
        b.dead = true;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
  G.enemies = G.enemies.filter((e) => !e.dead);
  G.cops = G.cops.filter((c) => !c.dead);
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, dmg * 0.6);
    p.armor -= absorbed;
    dmg -= absorbed;
  }
  p.hp -= dmg;
  p.lastHurt = 0;
  G.cam.shake = Math.min(9, G.cam.shake + 3);
  if (p.hp <= 0) {
    p.hp = 0;
    G.wasted();
  }
}

export function stepEnemies(G, dt) {
  const p = G.player;
  for (const e of G.enemies) {
    const d = dist(e.x, e.y, p.x, p.y);
    e.angle = angleTo(e.x, e.y, p.x, p.y);
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafe *= -1;
      e.strafeT = 0.7 + Math.random() * 1.1;
    }
    // Close in until firing range, then strafe sideways while shooting.
    let mx = 0;
    let my = 0;
    if (d > 320) {
      mx = Math.cos(e.angle);
      my = Math.sin(e.angle);
    } else if (d < 150) {
      mx = -Math.cos(e.angle) * 0.6;
      my = -Math.sin(e.angle) * 0.6;
    }
    const sx = Math.cos(e.angle + Math.PI / 2) * e.strafe * 0.7;
    const sy = Math.sin(e.angle + Math.PI / 2) * e.strafe * 0.7;
    e.x += (mx + sx) * 95 * dt;
    e.y += (my + sy) * 95 * dt;
    for (const b of G.world.buildings) circleRectResolve(e, 16, b);
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < 460) {
      e.cooldown = 1.1 + Math.random() * 0.9;
      const spread = (Math.random() - 0.5) * 0.22;
      fireBullet(G, e.x + Math.cos(e.angle) * 24, e.y + Math.sin(e.angle) * 24, e.angle + spread, false, 480);
      G.sound.enemyShot();
      burst(G, e.x + Math.cos(e.angle) * 24, e.y + Math.sin(e.angle) * 24, '#ffd23e', 3);
    }
  }
}

export function stepParts(G, dt) {
  for (const pt of G.parts) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - dt * 2.2;
    pt.vy *= 1 - dt * 2.2;
    pt.life -= dt;
  }
  G.parts = G.parts.filter((pt) => pt.life > 0);
  if (G.recentShot > 0) G.recentShot -= dt;
}

export { burst };
