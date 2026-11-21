// VELMARA — render.js: draws the world. Golden-hour 2.5D: extruded
// buildings with long east shadows, neon signs, palms, canal, marina and
// beach; cars with headlights, peds, enemies, the player, tracers and
// particles; and a live minimap. Everything is drawn in code — no images.
import { WORLD_W, WORLD_H, ROAD, ROAD_W, COLS, ROWS, intersection, districtAt } from './city.js';
import { clamp, lerp } from './util.js';

export const VIEW_W = 1280;
export const VIEW_H = 720;

let mapCanvas = null;

export function drawWorld(ctx, game, cam, time) {
  const { city } = game;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  // Sky-warm ground base.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  const vx0 = cam.x - 40, vy0 = cam.y - 40, vx1 = cam.x + VIEW_W + 40, vy1 = cam.y + VIEW_H + 40;
  drawGround(ctx, city, vx0, vy0, vx1, vy1);
  drawRoads(ctx, vx0, vy0, vx1, vy1);
  drawParks(ctx, city, vx0, vy0, vx1, vy1);
  drawCanal(ctx, city, vx0, vy0, vx1, vy1);
  drawBoats(ctx, city, time, vx0, vy0, vx1, vy1);
  drawBeach(ctx, vx0, vy0, vx1, vy1, time);
  drawPalms(ctx, city, vx0, vy0, vx1, vy1, time, true);
  drawObjectiveBeacon(ctx, game, time);
  drawCashDrops(ctx, game, time, vx0, vy0, vx1, vy1);
  drawGoldBars(ctx, game, time, vx0, vy0, vx1, vy1);
  drawCars(ctx, game, vx0, vy0, vx1, vy1, time);
  drawPeds(ctx, game, vx0, vy0, vx1, vy1, time);
  drawEnemies(ctx, game, vx0, vy0, vx1, vy1, time);
  drawPlayer(ctx, game, time);
  drawBullets(ctx, game);
  drawParticles(ctx, game);
  drawBuildings(ctx, city, vx0, vy0, vx1, vy1, time);
  drawPalms(ctx, city, vx0, vy0, vx1, vy1, time, false);
  drawNeonSigns(ctx, city, vx0, vy0, vx1, vy1, time);
  drawPlaceLabels(ctx, game, vx0, vy0, vx1, vy1);
  ctx.restore();
  // Golden-hour wash + vignette, screen space.
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, 'rgba(255,150,60,0.05)');
  g.addColorStop(0.6, 'rgba(255,120,40,0.02)');
  g.addColorStop(1, 'rgba(120,40,120,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const v = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(20,8,30,0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

function inView(x, y, vx0, vy0, vx1, vy1, m) {
  return x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;
}

function drawGround(ctx, city, vx0, vy0, vx1, vy1) {
  // Block ground: warm pavement with a subtle checker of district tints.
  for (let c = 0; c < COLS - 1; c += 1) {
    for (let r = 0; r < ROWS - 1; r += 1) {
      const x = c * ROAD + ROAD_W, y = r * ROAD + ROAD_W;
      const w = ROAD - ROAD_W, h = ROAD - ROAD_W;
      if (x > vx1 || x + w < vx0 || y > vy1 || y + h < vy0) continue;
      ctx.fillStyle = (c + r) % 2 === 0 ? '#b59a72' : '#ad9268';
      ctx.fillRect(x, y, w, h);
    }
  }
}

function drawRoads(ctx, vx0, vy0, vx1, vy1) {
  ctx.fillStyle = '#3d3a44';
  for (let i = 0; i < COLS; i += 1) {
    const x = i * ROAD;
    if (x > vx1 || x + ROAD_W < vx0) continue;
    ctx.fillRect(x, 0, ROAD_W, WORLD_H);
  }
  for (let j = 0; j < ROWS; j += 1) {
    const y = j * ROAD;
    if (y > vy1 || y + ROAD_W < vy0) continue;
    ctx.fillRect(0, y, WORLD_W, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = '#e8d27a';
  for (let i = 0; i < COLS; i += 1) {
    const x = i * ROAD + ROAD_W / 2 - 2;
    if (x < vx0 || x > vx1) continue;
    for (let y = 0; y < WORLD_H; y += 56) {
      if (y < vy0 || y > vy1) continue;
      ctx.fillRect(x, y, 4, 28);
    }
  }
  for (let j = 0; j < ROWS; j += 1) {
    const y = j * ROAD + ROAD_W / 2 - 2;
    if (y < vy0 || y > vy1) continue;
    for (let x = 0; x < WORLD_W; x += 56) {
      if (x < vx0 || x > vx1) continue;
      ctx.fillRect(x, y, 28, 4);
    }
  }
  // Sidewalk edge.
  ctx.strokeStyle = 'rgba(240,230,200,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < COLS; i += 1) {
    const x = i * ROAD;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.moveTo(x + ROAD_W, 0); ctx.lineTo(x + ROAD_W, WORLD_H); ctx.stroke();
  }
  for (let j = 0; j < ROWS; j += 1) {
    const y = j * ROAD;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.moveTo(0, y + ROAD_W); ctx.lineTo(WORLD_W, y + ROAD_W); ctx.stroke();
  }
}

function drawParks(ctx, city, vx0, vy0, vx1, vy1) {
  for (const p of city.parks) {
    if (!inView(p.x, p.y, vx0, vy0, vx1, vy1, 100)) continue;
    ctx.fillStyle = '#6da35a';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#5c8f4c';
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8c690';
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, Math.min(p.w, p.h) * 0.12, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCanal(ctx, city, vx0, vy0, vx1, vy1) {
  const c = city.canal;
  if (c.x > vx1 || c.x + c.w < vx0) return;
  ctx.fillStyle = '#7a6a58';
  ctx.fillRect(c.x - 16, 0, c.w + 32, c.h);
  ctx.fillStyle = '#2f7ea8';
  ctx.fillRect(c.x, 0, c.w, c.h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let y = 20; y < c.h; y += 64) ctx.fillRect(c.x + 8, y, c.w - 16, 3);
  // Bridges: road surface over the canal at the two crossing roads.
  ctx.fillStyle = '#3d3a44';
  ctx.fillRect(c.x - 16, ROAD - 6, c.w + 32, ROAD_W + 12);
  ctx.fillRect(c.x - 16, 2 * ROAD - 6, c.w + 32, ROAD_W + 12);
}

function drawBoats(ctx, city, time, vx0, vy0, vx1, vy1) {
  for (const b of city.boats) {
    if (!inView(b.x, b.y, vx0, vy0, vx1, vy1, 60)) continue;
    ctx.save();
    ctx.translate(b.x, b.y + Math.sin(time * 0.8 + b.x) * 2);
    ctx.rotate(b.angle);
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b3a55';
    ctx.fillRect(-8, -6, 18, 10);
    ctx.restore();
  }
}

function drawBeach(ctx, vx0, vy0, vx1, vy1, time) {
  if (vy1 < 1980) return;
  // Sand, then sea with animated surf.
  ctx.fillStyle = '#eed9a4';
  ctx.fillRect(0, 1980, WORLD_W, 180);
  ctx.fillStyle = '#2f7ea8';
  ctx.fillRect(0, 2080, WORLD_W, 80);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let x = 0; x < WORLD_W; x += 90) {
    const y = 2080 + Math.sin(time * 1.4 + x * 0.02) * 4;
    ctx.fillRect(x, y, 46, 4);
  }
  ctx.fillStyle = '#f7ede2';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('PLAYA DEL SOL', 60, 2050);
}

function drawPalms(ctx, city, vx0, vy0, vx1, vy1, time, shadowsOnly) {
  for (const p of city.palms) {
    if (!inView(p.x, p.y, vx0, vy0, vx1, vy1, 60)) continue;
    if (shadowsOnly) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(p.x + 26, p.y + 10, 26, 7, 0.4, 0, Math.PI * 2); ctx.fill();
    } else {
      const sway = Math.sin(time * 1.1 + p.x * 0.05) * 0.08;
      ctx.strokeStyle = '#8a6a45';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 22); ctx.stroke();
      ctx.strokeStyle = '#4d8a3f';
      ctx.lineWidth = 3;
      for (let i = 0; i < 5; i += 1) {
        const a = -Math.PI / 2 + (i - 2) * 0.55 + sway;
        ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 22);
        ctx.quadraticCurveTo(p.x + 4 + Math.cos(a) * 14, p.y - 22 + Math.sin(a) * 14, p.x + 4 + Math.cos(a) * 22, p.y - 22 + Math.sin(a) * 22 + 6);
        ctx.stroke();
      }
    }
  }
}

function drawBuildings(ctx, city, vx0, vy0, vx1, vy1, time) {
  const list = city.buildings.filter((b) => inView(b.x, b.y, vx0, vy0, vx1, vy1, 160));
  list.sort((a, b) => (a.y + a.h) - (b.y + b.h));
  for (const b of list) {
    const h = b.height;
    const ox = -h * 0.28, oy = -h * 0.5;
    // Long golden-hour shadow to the east.
    ctx.fillStyle = 'rgba(40,16,8,0.28)';
    ctx.beginPath();
    ctx.moveTo(b.x + h * 0.7, b.y + b.h * 0.4);
    ctx.lineTo(b.x + b.w + h * 0.7, b.y + b.h * 0.4);
    ctx.lineTo(b.x + b.w + h * 0.35, b.y + b.h);
    ctx.lineTo(b.x + h * 0.35, b.y + b.h);
    ctx.closePath(); ctx.fill();
    // South face.
    ctx.fillStyle = b.wall;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy); ctx.lineTo(b.x + ox, b.y + b.h + oy);
    ctx.closePath(); ctx.fill();
    // East face (darker).
    ctx.fillStyle = b.shade;
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y); ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x + b.w + ox, b.y + b.h + oy); ctx.lineTo(b.x + b.w + ox, b.y + oy);
    ctx.closePath(); ctx.fill();
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + ox, b.y + oy, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + ox, b.y + oy, b.w, b.h);
    // Roof windows / AC units.
    ctx.fillStyle = 'rgba(30,30,50,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        if ((i * 7 + j * 3 + b.floors) % 4 === 0) continue;
        ctx.fillRect(b.x + ox + 7 + i * 26, b.y + oy + 7 + j * 26, 12, 12);
      }
    }
    // Lit windows on the south face at dusk.
    ctx.fillStyle = 'rgba(255,214,120,0.85)';
    const lit = Math.floor(b.w / 30);
    for (let i = 0; i < lit; i += 1) {
      if ((i + b.floors) % 3 !== 0) continue;
      ctx.fillRect(b.x + 8 + i * 30, b.y + b.h - 14, 10, 8);
    }
  }
}

function drawNeonSigns(ctx, city, vx0, vy0, vx1, vy1, time) {
  ctx.textAlign = 'center';
  for (const s of city.neonSigns) {
    if (!inView(s.x, s.y, vx0, vy0, vx1, vy1, 80)) continue;
    const glow = 0.65 + Math.sin(time * 3 + s.x) * 0.25;
    ctx.font = 'bold 17px sans-serif';
    ctx.fillStyle = s.color;
    ctx.globalAlpha = glow;
    ctx.fillText(s.text, s.x, s.y);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';
}

function drawPlaceLabels(ctx, game, vx0, vy0, vx1, vy1) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(game.places)) {
    const p = game.places[key];
    if (!inView(p.x, p.y, vx0, vy0, vx1, vy1, 120)) continue;
    ctx.fillStyle = 'rgba(20,12,30,0.55)';
    const w = ctx.measureText(p.label).width + 14;
    ctx.fillRect(p.x - w / 2, p.y - 52, w, 22);
    ctx.fillStyle = '#ffe9b8';
    ctx.fillText(p.label, p.x, p.y - 37);
  }
  ctx.textAlign = 'left';
}

function drawObjectiveBeacon(ctx, game, time) {
  const t = game.missions.target();
  if (!t) return;
  const pulse = 1 + Math.sin(time * 4) * 0.15;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(0, 0, 46 * pulse, 16 * pulse, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,63,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 0, 46 * pulse, 16 * pulse, 0, 0, Math.PI * 2); ctx.fill();
  // Light pillar.
  const grad = ctx.createLinearGradient(0, -190, 0, 0);
  grad.addColorStop(0, 'rgba(255,210,63,0)');
  grad.addColorStop(1, 'rgba(255,210,63,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(-13, -190, 26, 190);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(0, -196); ctx.lineTo(10, -178); ctx.lineTo(-10, -178); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawCashDrops(ctx, game, time, vx0, vy0, vx1, vy1) {
  for (const d of game.cashDrops) {
    if (d.taken || !inView(d.x, d.y, vx0, vy0, vx1, vy1, 40)) continue;
    const bob = Math.sin(time * 3 + d.x) * 3;
    ctx.fillStyle = '#2fae5f';
    ctx.save();
    ctx.translate(d.x, d.y + bob);
    ctx.rotate(0.3);
    ctx.fillRect(-11, -7, 22, 14);
    ctx.fillStyle = '#e8f5e9';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', 0, 4);
    ctx.restore();
    ctx.textAlign = 'left';
  }
}

function drawGoldBars(ctx, game, time, vx0, vy0, vx1, vy1) {
  for (const g of game.goldBars) {
    if (g.taken || !inView(g.x, g.y, vx0, vy0, vx1, vy1, 40)) continue;
    const glow = 0.5 + Math.sin(time * 5 + g.y) * 0.3;
    ctx.fillStyle = 'rgba(255,210,63,' + glow.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(g.x, g.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(g.x - 8, g.y - 4, 16, 8);
    ctx.fillStyle = '#a87b00';
    ctx.fillRect(g.x - 8, g.y + 1, 16, 3);
  }
}

function drawCarShape(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(4, 6, 26, 13, 0, 0, Math.PI * 2); ctx.fill();
  // Wheels.
  ctx.fillStyle = '#151515';
  ctx.fillRect(-16, -13, 9, 5); ctx.fillRect(-16, 8, 9, 5);
  ctx.fillRect(9, -13, 9, 5); ctx.fillRect(9, 8, 9, 5);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -22, -11, 44, 22, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Roof + windows.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, -8, -9, 16, 18, 4);
  ctx.fill();
  ctx.fillStyle = '#1d2733';
  ctx.fillRect(-4, -9, 6, 18);
  // Police livery.
  if (car.type === 'police') {
    ctx.fillStyle = '#f7f7f7';
    ctx.fillRect(-8, -11, 16, 22);
    ctx.fillStyle = '#1d2733';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VPD', 0, 3);
    ctx.textAlign = 'left';
    const phase = Math.floor(time * 4) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2e4d' : '#2e7bff';
    ctx.fillRect(-2, -13, 5, 5);
    ctx.fillStyle = phase ? '#2e7bff' : '#ff2e4d';
    ctx.fillRect(-2, 8, 5, 5);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1d2733';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(-12, -13, 8, 4);
  }
  // Headlight cones at dusk.
  ctx.fillStyle = 'rgba(255,240,180,0.20)';
  ctx.beginPath();
  ctx.moveTo(22, -8); ctx.lineTo(64, -20); ctx.lineTo(64, 20); ctx.lineTo(22, 8);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff6c9';
  ctx.fillRect(21, -9, 3, 4); ctx.fillRect(21, 5, 3, 4);
  // Damage smoke.
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath(); ctx.arc(-18 + Math.sin(time * 9) * 3, -4, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, game, vx0, vy0, vx1, vy1, time) {
  const all = [...game.parkedCars, ...game.trafficCars, ...game.policeCars];
  if (game.player.car && !all.includes(game.player.car)) all.push(game.player.car);
  if (game.targetCar && !all.includes(game.targetCar)) all.push(game.targetCar);
  for (const c of all) {
    if (c.dead || !inView(c.x, c.y, vx0, vy0, vx1, vy1, 80)) continue;
    drawCarShape(ctx, c, time);
  }
}

function drawPeds(ctx, game, vx0, vy0, vx1, vy1, time) {
  for (const p of game.peds) {
    if (p.dead || !inView(p.x, p.y, vx0, vy0, vx1, vy1, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(p.x, p.y - 2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x, p.y - 4, 5.5, Math.PI, 0); ctx.fill();
    if (p.fleeing) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 16);
      ctx.textAlign = 'left';
    }
  }
}

function drawEnemies(ctx, game, vx0, vy0, vx1, vy1, time) {
  for (const e of game.enemies) {
    if (e.dead || !inView(e.x, e.y, vx0, vy0, vx1, vy1, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(e.x + 3, e.y + 5, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = e.shirt;
    ctx.beginPath(); ctx.arc(e.x, e.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8a077';
    ctx.beginPath(); ctx.arc(e.x, e.y - 2, 6, 0, Math.PI * 2); ctx.fill();
    // Gun toward the player.
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20);
    ctx.stroke();
    if (e.flash > 0) {
      ctx.fillStyle = 'rgba(255,220,120,' + e.flash.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(e.x + Math.cos(e.angle) * 22, e.y + Math.sin(e.angle) * 22, 7, 0, Math.PI * 2); ctx.fill();
    }
    // HP bar.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - 14, e.y - 26, 28, 5);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(e.x - 14, e.y - 26, 28 * clamp(e.hp / 60, 0, 1), 5);
    void time;
  }
}

function drawPlayer(ctx, game, time) {
  const p = game.player;
  if (p.dead || !p.onFoot) return;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 6, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Aim line.
  const aim = game.aimAngle;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(aim) * 46, p.y + Math.sin(aim) * 46);
  ctx.stroke();
  // Body: teal jacket, dark jeans.
  ctx.fillStyle = '#0f8a8a';
  ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(p.x, p.y - 2, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2b2b33';
  ctx.beginPath(); ctx.arc(p.x, p.y - 4, 6.5, Math.PI, 0); ctx.fill();
  // Pistol.
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(aim) * 20, p.y + Math.sin(aim) * 20);
  ctx.stroke();
  if (game.muzzleFlash > 0) {
    ctx.fillStyle = 'rgba(255,220,120,' + game.muzzleFlash.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(aim) * 24, p.y + Math.sin(aim) * 24, 9, 0, Math.PI * 2); ctx.fill();
  }
  void time;
}

function drawBullets(ctx, game) {
  for (const b of game.bullets) {
    if (b.dead) continue;
    ctx.strokeStyle = b.fromPlayer ? '#ffe27a' : '#ff9a7a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, game) {
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Live minimap: prerendered city + moving dots. */
export function drawMinimap(ctx, game, x, y, w, h) {
  if (!mapCanvas) {
    mapCanvas = document.createElement('canvas');
    mapCanvas.width = 288; mapCanvas.height = 216;
    const m = mapCanvas.getContext('2d');
    m.fillStyle = '#b59a72'; m.fillRect(0, 0, 288, 216);
    m.fillStyle = '#2f7ea8'; m.fillRect(game.city.canal.x / 10, 0, game.city.canal.w / 10, game.city.canal.h / 10);
    m.fillStyle = '#eed9a4'; m.fillRect(0, 198, 288, 18);
    m.fillStyle = '#2f7ea8'; m.fillRect(0, 208, 288, 8);
    m.fillStyle = '#3d3a44';
    for (let i = 0; i < COLS; i += 1) m.fillRect(i * ROAD / 10, 0, ROAD_W / 10, 216);
    for (let j = 0; j < ROWS; j += 1) m.fillRect(0, j * ROAD / 10, 288, ROAD_W / 10);
    m.fillStyle = 'rgba(60,40,20,0.5)';
    for (const b of game.city.buildings) m.fillRect(b.x / 10, b.y / 10, b.w / 10, b.h / 10);
    m.fillStyle = '#6da35a';
    for (const p of game.city.parks) m.fillRect(p.x / 10, p.y / 10, p.w / 10, p.h / 10);
  }
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(10,8,20,0.72)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
  ctx.drawImage(mapCanvas, x, y, w, h);
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2); ctx.fill();
  };
  const t = game.missions.target();
  if (t) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(x + t.x * sx, y + t.y * sy, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + t.x * sx, y + t.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }
  for (const g of game.goldBars) if (!g.taken) dot(g.x, g.y, '#ffe27a', 2);
  for (const c of game.policeCars) if (!c.dead) dot(c.x, c.y, '#2e7bff', 3.5);
  for (const o of game.policeOfficers) if (!o.dead) dot(o.x, o.y, '#7ab8ff', 2.5);
  for (const e of game.enemies) if (!e.dead) dot(e.x, e.y, '#ff4d4d', 3);
  // Player arrow.
  const px = x + game.player.x * sx, py = y + game.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // District label, top-left inside the minimap.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(game.player.x, game.player.y).toUpperCase(), x + 4, y + 13);
  ctx.restore();
}
