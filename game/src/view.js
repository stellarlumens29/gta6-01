// view.js — the 2.5D golden-hour renderer and the live minimap.
// Draws the world from game state only: ground, water, roads, buildings
// with long east shadows and lit windows, cars, peds, player, bullets,
// particles, beacons — then a warm dusk wash and vignette on top.

import { clamp, dist, angleTo } from './rng.js';
import { districtAt } from './world.js';
import { objectiveTarget } from './story.js';

export function worldToScreen(G, x, y) {
  return { x: x - G.cam.x, y: y - G.cam.y };
}

function inView(G, x, y, pad) {
  return x > G.cam.x - pad && x < G.cam.x + 1280 + pad && y > G.cam.y - pad && y < G.cam.y + 720 + pad;
}

export function drawWorld(ctx, G) {
  const w = G.world;
  const cam = G.cam;
  ctx.save();
  ctx.clearRect(0, 0, 1280, 720);

  // --- ground: district tints -------------------------------------------
  ctx.fillStyle = '#c99a63';
  ctx.fillRect(0, 0, 1280, 720);
  for (const d of w.districts || []) {
    const s = worldToScreen(G, d.x, d.y);
    ctx.fillStyle = d.tint;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(s.x, s.y, d.w, d.h);
    ctx.globalAlpha = 1;
  }
  // Parks and plaza.
  ctx.fillStyle = '#6f9e57';
  for (const pk of w.parks) {
    const s = worldToScreen(G, pk.x, pk.y);
    ctx.fillRect(s.x, s.y, pk.w, pk.h);
  }
  ctx.fillStyle = '#d9c49a';
  const pz = worldToScreen(G, w.plaza.x, w.plaza.y);
  ctx.fillRect(pz.x, pz.y, w.plaza.w, w.plaza.h);
  ctx.strokeStyle = 'rgba(120,80,40,0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(pz.x + 8, pz.y + 8, w.plaza.w - 16, w.plaza.h - 16);

  // --- water: canal, marina, sea -----------------------------------------
  const t = G.time;
  ctx.fillStyle = '#3f7d9e';
  const cn = worldToScreen(G, 0, w.canal.y0);
  ctx.fillRect(cn.x, cn.y, w.W, w.canal.y1 - w.canal.y0);
  const mn = worldToScreen(G, w.marina.x, w.marina.y);
  ctx.fillRect(mn.x, mn.y, w.marina.w, w.marina.h);
  const bc = worldToScreen(G, 0, w.beach.y0 + 90);
  ctx.fillStyle = '#2f6d8f';
  ctx.fillRect(bc.x, bc.y, w.W, w.H - w.beach.y0);
  // Beach sand.
  ctx.fillStyle = '#ecd096';
  const bs = worldToScreen(G, 0, w.beach.y0);
  ctx.fillRect(bs.x, bs.y, w.W, 90);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wy = worldToScreen(G, 0, w.beach.y0 + 96 + i * 26 + Math.sin(t * 1.4 + i * 2) * 5).y;
    ctx.beginPath();
    for (let x = 0; x <= 1280; x += 32) {
      const yy = wy + Math.sin(x * 0.02 + t * 2 + i) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Canal sparkle.
  ctx.strokeStyle = 'rgba(255,220,150,0.35)';
  for (let i = 0; i < 8; i++) {
    const sx = ((i * 340 + t * 24) % w.W) - cam.x;
    const sy = cn.y + 24 + (i % 4) * 32;
    if (sx > -20 && sx < 1300) {
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + 26, sy);
      ctx.stroke();
    }
  }

  // --- roads ---------------------------------------------------------------
  ctx.fillStyle = '#4a4a52';
  for (const rx of w.roadsX) {
    const s = worldToScreen(G, rx - 32, 0);
    ctx.fillRect(s.x, s.y, 64, w.H);
  }
  for (const ry of w.roadsY) {
    const s = worldToScreen(G, 0, ry - 32);
    ctx.fillRect(s.x, s.y, w.W, 64);
  }
  // Bridges over the canal.
  ctx.fillStyle = '#5d5d68';
  for (const bx of w.canal.bridges) {
    const s = worldToScreen(G, bx - 32, w.canal.y0 - 8);
    ctx.fillRect(s.x, s.y, 64, w.canal.y1 - w.canal.y0 + 16);
  }
  // Centre dashes.
  ctx.strokeStyle = 'rgba(240,220,120,0.75)';
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 26]);
  for (const rx of w.roadsX) {
    const s = worldToScreen(G, rx, 0);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x, s.y + w.H);
    ctx.stroke();
  }
  for (const ry of w.roadsY) {
    const s = worldToScreen(G, 0, ry);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + w.W, s.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- boats in the marina -------------------------------------------------
  for (let i = 0; i < 4; i++) {
    const bx = w.marina.x + 50 + i * 90;
    const by = w.marina.y + 40 + (i % 2) * 110 + Math.sin(t + i) * 3;
    const s = worldToScreen(G, bx, by);
    if (!inView(G, bx, by, 80)) continue;
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(s.x - 26, s.y - 10, 52, 20);
    ctx.fillStyle = '#d94f3d';
    ctx.fillRect(s.x - 8, s.y - 26, 4, 18);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y - 26);
    ctx.lineTo(s.x + 16, s.y - 8);
    ctx.lineTo(s.x - 4, s.y - 8);
    ctx.fill();
  }

  // --- buildings: shadow, two shaded faces, roof, lit windows -------------
  const sorted = [...w.buildings].sort((a, b) => a.y + a.d - (b.y + b.d));
  for (const b of sorted) {
    const s = worldToScreen(G, b.x, b.y);
    if (!inView(G, b.x, b.y, 260)) continue;
    const h = b.h;
    // Long east shadow (sun low in the west at golden hour).
    ctx.fillStyle = 'rgba(60,30,10,0.28)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y + b.d);
    ctx.lineTo(s.x + h * 0.9, s.y + b.d + h * 0.28);
    ctx.lineTo(s.x + b.w + h * 0.9, s.y + b.d + h * 0.28);
    ctx.lineTo(s.x + b.w, s.y + b.d);
    ctx.closePath();
    ctx.fill();
    // South face (warm shade) and east face (deeper shade).
    ctx.fillStyle = `hsl(${b.hue}, 42%, 42%)`;
    ctx.fillRect(s.x, s.y + b.d, b.w, h * 0.32);
    ctx.fillStyle = `hsl(${b.hue}, 45%, 32%)`;
    ctx.beginPath();
    ctx.moveTo(s.x + b.w, s.y);
    ctx.lineTo(s.x + b.w + h * 0.42, s.y - h * 0.3);
    ctx.lineTo(s.x + b.w + h * 0.42, s.y + b.d - h * 0.3);
    ctx.lineTo(s.x + b.w, s.y + b.d);
    ctx.closePath();
    ctx.fill();
    // Roof.
    ctx.fillStyle = `hsl(${b.hue}, 48%, 58%)`;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + h * 0.42, s.y - h * 0.3);
    ctx.lineTo(s.x + b.w + h * 0.42, s.y - h * 0.3);
    ctx.lineTo(s.x + b.w, s.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Lit windows on the south face.
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = 2;
    for (let cx = 0; cx < cols; cx++) {
      for (let ry = 0; ry < rows; ry++) {
        const lit = ((b.x * 7 + b.y * 13 + cx * 5 + ry * 11) % 10) / 10 < b.lit;
        if (!lit) continue;
        ctx.fillStyle = '#ffd98a';
        ctx.fillRect(s.x + 10 + cx * ((b.w - 20) / cols), s.y + b.d + 5 + ry * ((h * 0.32 - 12) / rows), 9, 7);
      }
    }
    if (b.sign) {
      ctx.fillStyle = '#ff5da2';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.sign, s.x + b.w / 2, s.y - h * 0.3 - 6);
    }
  }

  // --- neon signs ----------------------------------------------------------
  ctx.textAlign = 'center';
  for (const sg of w.signs) {
    const s = worldToScreen(G, sg.x, sg.y);
    if (!inView(G, sg.x, sg.y, 120)) continue;
    const flicker = 0.75 + 0.25 * Math.sin(t * 3 + sg.x);
    ctx.globalAlpha = flicker;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = sg.color;
    ctx.shadowColor = sg.color;
    ctx.shadowBlur = 16;
    ctx.fillText(sg.text, s.x, s.y);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // --- palms ---------------------------------------------------------------
  for (const palm of w.palms) {
    const s = worldToScreen(G, palm.x, palm.y);
    if (!inView(G, palm.x, palm.y, 60)) continue;
    ctx.strokeStyle = '#7a5230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + palm.lean * 22, s.y - 26 * palm.s);
    ctx.stroke();
    ctx.strokeStyle = '#4e8a3f';
    ctx.lineWidth = 3;
    for (let f = 0; f < 5; f++) {
      const a = -Math.PI / 2 + (f - 2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(s.x + palm.lean * 22, s.y - 26 * palm.s);
      ctx.lineTo(s.x + palm.lean * 22 + Math.cos(a) * 20 * palm.s, s.y - 26 * palm.s + Math.sin(a) * 12 * palm.s + 8);
      ctx.stroke();
    }
  }

  drawMarkers(G, ctx);
  drawVehicles(G, ctx);
  drawPeds(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawParts(G, ctx);
  drawBeacon(G, ctx);

  // --- golden-hour wash + vignette ----------------------------------------
  const wash = ctx.createLinearGradient(0, 0, 1280, 720);
  wash.addColorStop(0, 'rgba(255,170,80,0.10)');
  wash.addColorStop(0.6, 'rgba(255,120,60,0.06)');
  wash.addColorStop(1, 'rgba(120,40,90,0.10)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, 1280, 720);
  const vig = ctx.createRadialGradient(640, 360, 300, 640, 360, 780);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(20,8,20,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, 1280, 720);

  // District label, bottom-left of the world view, clear of the HP panel.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(districtAt(w, G.player.x, G.player.y), 280, 700);

  ctx.restore();
}

function drawMarkers(G, ctx) {
  const w = G.world;
  // Gold bars.
  for (const g of w.goldSpots) {
    if (g.taken) continue;
    const s = worldToScreen(G, g.x, g.y);
    if (!inView(G, g.x, g.y, 40)) continue;
    ctx.save();
    ctx.translate(s.x, s.y + Math.sin(G.time * 2 + g.x) * 3);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-7, -4, 14, 8);
    ctx.fillStyle = '#fff3b0';
    ctx.fillRect(-7, -4, 14, 3);
    ctx.restore();
  }
  // Mission stash spots.
  const st = G.story.stepState;
  if (st && st.spots) {
    for (const s of st.spots) {
      if (s.taken) continue;
      const p = worldToScreen(G, s.x, s.y);
      if (!inView(G, s.x, s.y, 40)) continue;
      ctx.fillStyle = '#39d0ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 4);
    }
  }
  // Taxi rider / destination.
  const t = G.taxi;
  if (t && t.active) {
    const tx = t.phase === 'pickup' ? t.px : t.dx;
    const ty = t.phase === 'pickup' ? t.py : t.dy;
    const p = worldToScreen(G, tx, ty);
    ctx.fillStyle = t.phase === 'pickup' ? '#39d0ff' : '#7CFC66';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10202e';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(t.phase === 'pickup' ? '?' : '$', p.x, p.y + 4);
  }
  // Shops.
  for (const s of w.shops) {
    const p = worldToScreen(G, s.x, s.y);
    if (!inView(G, s.x, s.y, 60)) continue;
    ctx.fillStyle = '#20242e';
    ctx.fillRect(p.x - 34, p.y - 20, 68, 40);
    ctx.fillStyle = s.kind === 'guns' ? '#ffd23e' : '#7CFC66';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.kind === 'guns' ? 'GUNS' : 'REPAIR', p.x, p.y + 4);
  }
  // Vault + yacht markers.
  for (const m of [{ x: w.vault.x, y: w.vault.y, label: 'BANK' }, { x: w.yacht.x, y: w.yacht.y, label: 'YACHT' }]) {
    const p = worldToScreen(G, m.x, m.y);
    if (!inView(G, m.x, m.y, 60)) continue;
    ctx.fillStyle = 'rgba(20,20,30,0.8)';
    ctx.fillRect(p.x - 30, p.y - 12, 60, 22);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.label, p.x, p.y + 4);
  }
}

function drawCarShape(ctx, x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (opts && opts.shadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-20, -10 + 6, 44, 22);
  }
  ctx.fillStyle = color;
  const len = opts && opts.len ? opts.len : 44;
  const wid = opts && opts.wid ? opts.wid : 22;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  ctx.beginPath();
  ctx.roundRect(-len * 0.18, -wid / 2 + 3, len * 0.28, wid - 6, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(len / 2 - 4, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 4, wid / 2 - 8, 3, 5);
  // Headlight cones at dusk.
  if (opts && opts.lights) {
    const grad = ctx.createLinearGradient(len / 2, 0, len / 2 + 150, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.28)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(len / 2, -8);
    ctx.lineTo(len / 2 + 150, -42);
    ctx.lineTo(len / 2 + 150, 42);
    ctx.lineTo(len / 2, 8);
    ctx.closePath();
    ctx.fill();
  }
  if (opts && opts.smoke) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(-len / 2 - 6, (Math.random() - 0.5) * 10, 5 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVehicles(G, ctx) {
  const all = [];
  for (const pk of G.world.parked) if (pk.car && !pk.taken) all.push(pk.car);
  for (const c of G.traffic) all.push(c);
  for (const c of G.cops) if (c.car) all.push(c.car);
  if (G.player.vehicle) all.push(G.player.vehicle);
  for (const car of all) {
    const s = worldToScreen(G, car.x, car.y);
    if (!inView(G, car.x, car.y, 160)) continue;
    const isCop = car.type === 6;
    drawCarShape(ctx, s.x, s.y, car.angle, car.color, {
      lights: true,
      smoke: car.smoke > 0.3,
      shadow: true,
    });
    if (isCop) {
      // Light bar, alternating red/blue.
      const on = Math.floor(G.time * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(s.x - 4, s.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = on ? '#2f7bff' : '#ff3b30';
      ctx.beginPath();
      ctx.arc(s.x + 6, s.y - 2, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (car.target) {
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('▼ VELOCE GT', s.x, s.y - 34);
    }
    if (car.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(s.x - 20, s.y - 30, 40, 5);
      ctx.fillStyle = car.hp > 40 ? '#7CFC66' : '#ff5d5d';
      ctx.fillRect(s.x - 20, s.y - 30, 40 * Math.max(0, car.hp / 100), 5);
    }
  }
  // Roadblocks at 3+ stars.
  if (G.wanted >= 3) {
    for (const b of G.roadblocks || []) {
      const s = worldToScreen(G, b.x, b.y);
      drawCarShape(ctx, s.x, s.y, 0, '#1c2733', { lights: true, shadow: true });
    }
  }
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    const s = worldToScreen(G, ped.x, ped.y);
    if (!inView(G, ped.x, ped.y, 30)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 8, 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(s.x + Math.cos(ped.angle) * 3, s.y + Math.sin(ped.angle) * 3 - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', s.x, s.y - 14);
    }
  }
  // Foot officers.
  for (const c of G.cops) {
    if (!c.onFoot) continue;
    const s = worldToScreen(G, c.x, c.y);
    if (!inView(G, c.x, c.y, 30)) continue;
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#9db8d6';
    ctx.beginPath();
    ctx.arc(s.x, s.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  const s = worldToScreen(G, p.x, p.y);
  if (p.onFoot) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y + 9, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mara: teal jacket, dark hair, gold hoop — readable at any zoom.
    ctx.fillStyle = '#0f766e';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(s.x + Math.cos(p.angle) * 3, s.y + Math.sin(p.angle) * 3 - 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Aim line while the mouse is down.
    if (G.input && G.input.mouse.down) {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + Math.cos(p.angle) * 46, s.y + Math.sin(p.angle) * 46);
      ctx.stroke();
    }
  }
  // Enemies with HP bars.
  for (const e of G.enemies) {
    const es = worldToScreen(G, e.x, e.y);
    if (!inView(G, e.x, e.y, 40)) continue;
    ctx.fillStyle = '#5a1f1f';
    ctx.beginPath();
    ctx.arc(es.x, es.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d9d9d9';
    ctx.beginPath();
    ctx.arc(es.x, es.y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(es.x - 18, es.y - 24, 36, 5);
    ctx.fillStyle = '#ff5d5d';
    ctx.fillRect(es.x - 18, es.y - 24, 36 * Math.max(0, e.hp / e.maxHp), 5);
  }
}

function drawBullets(G, ctx) {
  for (const b of G.bullets) {
    const s = worldToScreen(G, b.x, b.y);
    ctx.strokeStyle = b.friendly ? '#ffd23e' : '#ff7a5d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(s.x - b.vx * 0.03, s.y - b.vy * 0.03);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
  }
}

function drawParts(G, ctx) {
  for (const pt of G.parts) {
    const s = worldToScreen(G, pt.x, pt.y);
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBeacon(G, ctx) {
  const target = objectiveTarget(G);
  if (!target) return;
  const p = G.player;
  const d = dist(p.x, p.y, target.x, target.y);
  const s = worldToScreen(G, target.x, target.y);
  if (s.x > 30 && s.x < 1250 && s.y > 30 && s.y < 690) {
    // Pulsing beacon over the target.
    const r = 16 + Math.sin(G.time * 4) * 5;
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r - 14);
    ctx.lineTo(s.x - 7, s.y - r - 2);
    ctx.lineTo(s.x + 7, s.y - r - 2);
    ctx.closePath();
    ctx.fillStyle = '#ffd23e';
    ctx.fill();
  } else {
    // Edge arrow pointing at an off-screen target.
    const a = angleTo(p.x, p.y, target.x, target.y);
    const ex = clamp(640 + Math.cos(a) * 560, 40, 1240);
    const ey = clamp(360 + Math.sin(a) * 300, 40, 680);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(d)}m`, ex, ey + 28);
  }
}

// --- minimap ---------------------------------------------------------------
export function drawMinimap(ctx, G) {
  const w = G.world;
  const size = 168;
  const mx = 1280 - size - 16;
  const my = 720 - size - 16;
  const sx = size / w.W;
  const sy = size / w.H;
  ctx.save();
  ctx.fillStyle = 'rgba(12,14,22,0.82)';
  ctx.beginPath();
  ctx.roundRect(mx - 6, my - 6, size + 12, size + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(mx, my, size, size);
  ctx.clip();
  // Water + beach.
  ctx.fillStyle = '#3f7d9e';
  ctx.fillRect(mx, my + w.canal.y0 * sy, size, (w.canal.y1 - w.canal.y0) * sy);
  ctx.fillRect(mx, my + (w.beach.y0 + 90) * sy, size, size);
  ctx.fillStyle = '#ecd096';
  ctx.fillRect(mx, my + w.beach.y0 * sy, size, 90 * sy);
  // Roads.
  ctx.strokeStyle = 'rgba(220,220,230,0.7)';
  ctx.lineWidth = 1.5;
  for (const rx of w.roadsX) {
    ctx.beginPath();
    ctx.moveTo(mx + rx * sx, my);
    ctx.lineTo(mx + rx * sx, my + size);
    ctx.stroke();
  }
  for (const ry of w.roadsY) {
    ctx.beginPath();
    ctx.moveTo(mx, my + ry * sy);
    ctx.lineTo(mx + size, my + ry * sy);
    ctx.stroke();
  }
  // Gold (uncollected).
  ctx.fillStyle = '#ffd23e';
  for (const g of w.goldSpots) {
    if (!g.taken) ctx.fillRect(mx + g.x * sx - 1, my + g.y * sy - 1, 3, 3);
  }
  // Objective.
  const target = objectiveTarget(G);
  if (target) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(mx + target.x * sx, my + target.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops (blue) and enemies (red).
  ctx.fillStyle = '#2f7bff';
  for (const c of G.cops) ctx.fillRect(mx + c.x * sx - 2, my + c.y * sy - 2, 4, 4);
  ctx.fillStyle = '#ff5d5d';
  for (const e of G.enemies) ctx.fillRect(mx + e.x * sx - 2, my + e.y * sy - 2, 4, 4);
  // Player: white triangle, rotated to facing.
  const px = mx + G.player.x * sx;
  const py = my + G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // North + view cone.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', mx + 4, my + 12);
  ctx.restore();
}
