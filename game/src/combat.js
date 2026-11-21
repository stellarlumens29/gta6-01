// VELMARA — combat.js: shooting, rival gang members, bullets, particles
// and screen shake. Mouse aims, click fires. Enemies approach and shoot
// back; killing one during a mission is a crime the wanted system notices.
import { dist, randRange, pick } from './util.js';

export class Bullet {
  constructor(x, y, angle, speed, fromPlayer, damage) {
    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.fromPlayer = fromPlayer;
    this.damage = damage;
    this.life = 0.9;
    this.dead = false;
  }
  update(dt, colliders) {
    this.x += Math.cos(this.angle) * this.speed * dt;
    this.y += Math.sin(this.angle) * this.speed * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
    for (const b of colliders) {
      if (this.x > b.x && this.x < b.x + b.w && this.y > b.y && this.y < b.y + b.h) { this.dead = true; break; }
    }
  }
}

export class Enemy {
  constructor(x, y, rng) {
    this.x = x; this.y = y;
    this.angle = randRange(rng, 0, Math.PI * 2);
    this.hp = 60;
    this.speed = 118;
    this.radius = 14;
    this.shootTimer = randRange(rng, 0.4, 1.2);
    this.strafeDir = pick(rng, [-1, 1]);
    this.strafeTimer = randRange(rng, 1, 2.5);
    this.dead = false;
    this.flash = 0;
    this.shirt = pick(rng, ['#3a3a46', '#5b2a2a', '#2a4a3a']);
  }
  update(dt, player, bullets, colliders) {
    if (this.dead) return;
    this.flash = Math.max(0, this.flash - dt * 6);
    const d = dist(this.x, this.y, player.x, player.y);
    const a = Math.atan2(player.y - this.y, player.x - this.x);
    this.angle = a;
    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) { this.strafeDir *= -1; this.strafeTimer = randRange(Math.random, 1, 2.5); }
    if (d > 200) {
      this.x += Math.cos(a) * this.speed * dt;
      this.y += Math.sin(a) * this.speed * dt;
    } else if (d < 110) {
      this.x -= Math.cos(a) * this.speed * 0.6 * dt;
      this.y -= Math.sin(a) * this.speed * 0.6 * dt;
    } else {
      this.x += Math.cos(a + Math.PI / 2) * this.strafeDir * this.speed * 0.5 * dt;
      this.y += Math.sin(a + Math.PI / 2) * this.strafeDir * this.speed * 0.5 * dt;
    }
    // Stay out of buildings.
    for (const b of colliders) {
      if (this.x > b.x - 12 && this.x < b.x + b.w + 12 && this.y > b.y - 12 && this.y < b.y + b.h + 12) {
        this.x -= Math.cos(a) * this.speed * dt;
        this.y -= Math.sin(a) * this.speed * dt;
        break;
      }
    }
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && d < 460) {
      this.shootTimer = randRange(Math.random, 0.9, 1.7);
      const spread = randRange(Math.random, -0.12, 0.12);
      bullets.push(new Bullet(this.x + Math.cos(a) * 18, this.y + Math.sin(a) * 18, a + spread, 520, false, 9));
      this.flash = 1;
    }
  }
}

export class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life; this.color = color; this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.96; this.vy *= 0.96;
    this.life -= dt;
  }
}

export function spawnBlood(particles, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    const a = randRange(Math.random, 0, Math.PI * 2);
    const s = randRange(Math.random, 40, 160);
    particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(Math.random, 0.3, 0.7), '#c0392b', randRange(Math.random, 2, 4)));
  }
}
export function spawnSparks(particles, x, y, n, color) {
  for (let i = 0; i < n; i += 1) {
    const a = randRange(Math.random, 0, Math.PI * 2);
    const s = randRange(Math.random, 80, 260);
    particles.push(new Particle(x, y, Math.cos(a) * s, Math.sin(a) * s, randRange(Math.random, 0.15, 0.4), color || '#ffd23f', randRange(Math.random, 1.5, 3)));
  }
}
export function spawnSmoke(particles, x, y, n) {
  for (let i = 0; i < n; i += 1) {
    particles.push(new Particle(x + randRange(Math.random, -8, 8), y + randRange(Math.random, -8, 8), randRange(Math.random, -12, 12), randRange(Math.random, -30, -8), randRange(Math.random, 0.6, 1.4), '#8a8a8a', randRange(Math.random, 4, 9)));
  }
}

/** Resolve bullet hits against enemies, the player, cars and peds. */
export function resolveBullets(bullets, enemies, player, cars, peds, particles, onPlayerHit, onEnemyKilled, onPedHit) {
  for (const b of bullets) {
    if (b.dead) continue;
    if (b.fromPlayer) {
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < e.radius + 4) {
          e.hp -= b.damage; e.flash = 1; b.dead = true;
          spawnBlood(particles, b.x, b.y, 6);
          if (e.hp <= 0) { e.dead = true; spawnBlood(particles, e.x, e.y, 16); onEnemyKilled(e); }
          break;
        }
      }
      if (b.dead) continue;
      for (const p of peds) {
        if (p.dead) continue;
        if (dist(b.x, b.y, p.x, p.y) < p.radius + 4) {
          p.dead = true; b.dead = true;
          spawnBlood(particles, b.x, b.y, 12);
          onPedHit(p);
          break;
        }
      }
      if (b.dead) continue;
      for (const c of cars) {
        if (c.dead || c === player.car) continue;
        if (dist(b.x, b.y, c.x, c.y) < 22) {
          c.damage(12); b.dead = true;
          spawnSparks(particles, b.x, b.y, 5);
          break;
        }
      }
    } else {
      if (!player.dead && player.onFoot && dist(b.x, b.y, player.x, player.y) < player.radius + 4) {
        b.dead = true;
        onPlayerHit(b.damage);
      } else if (!player.dead && player.car && dist(b.x, b.y, player.car.x, player.car.y) < 22) {
        b.dead = true;
        player.car.damage(6);
        spawnSparks(particles, b.x, b.y, 4);
      }
    }
  }
}
