// panel.js — HUD, objective tracker, menus and end screens.
// Everything here draws on the same canvas the world uses; no DOM UI.

import { clamp } from './rng.js';
import { drawMinimap } from './view.js';
import { JOBS, objectiveText } from './story.js';
import { SHOP_STOCK, nearShop } from './side.js';
import { districtAt } from './world.js';

function clockString(G) {
  const h = Math.floor(G.clockMin / 60) % 24;
  const m = Math.floor(G.clockMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function stars(ctx, x, y, n) {
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < n ? '#ffd23e' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 24, y);
  }
}

function bar(ctx, x, y, w, frac, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, 12, 6);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w * clamp(frac, 0, 1), 12, 6);
  ctx.fill();
}

export function drawHUD(ctx, G) {
  const p = G.player;
  ctx.save();
  ctx.textAlign = 'left';

  // Top-left: cash, debt, clock, objective.
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 330, 96, 10);
  ctx.fill();
  ctx.fillStyle = '#7CFC66';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`$${G.cash.toLocaleString('en-US')}`, 24, 42);
  ctx.fillStyle = '#ff8a8a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`DEBT $${G.debt.toLocaleString('en-US')} — Tio Anselmo`, 24, 64);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px sans-serif';
  ctx.fillText(`${clockString(G)}  ·  ${districtAt(G.world, p.x, p.y)}`, 24, 84);
  // Objective line sits just under the panel.
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  const obj = objectiveText(G);
  const objW = ctx.measureText(obj).width + 24;
  ctx.beginPath();
  ctx.roundRect(12, 116, Math.min(objW, 700), 26, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(obj, 24, 134);

  // Top-right: wanted stars + heat label.
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  ctx.beginPath();
  ctx.roundRect(1280 - 190, 12, 178, 56, 10);
  ctx.fill();
  stars(ctx, 1280 - 178, 40, G.wanted);
  ctx.fillStyle = G.wanted >= 3 ? '#ff5d5d' : 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText(G.wanted >= 3 ? 'MANHUNT' : G.wanted > 0 ? 'WANTED' : 'CLEAN', 1280 - 178, 60);

  // Bottom-left: health, armor, ammo.
  ctx.fillStyle = 'rgba(10,12,20,0.62)';
  ctx.beginPath();
  ctx.roundRect(12, 720 - 100, 250, 88, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HP', 24, 720 - 74);
  bar(ctx, 72, 720 - 84, 158, p.hp / 100, p.hp > 40 ? '#7CFC66' : '#ff5d5d');
  ctx.fillText('ARMOR', 24, 720 - 50);
  bar(ctx, 72, 720 - 60, 158, p.armor / 100, '#7fb3ff');
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`AMMO ${p.ammo} / ${p.reserve}`, 24, 720 - 24);

  // Bottom-right: speed + minimap.
  if (p.vehicle) {
    const kmh = Math.round(Math.abs(p.vehicle.speed) * 1.35);
    ctx.fillStyle = 'rgba(10,12,20,0.62)';
    ctx.beginPath();
    ctx.roundRect(1280 - 220, 720 - 268, 200, 56, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, 1280 - 70, 720 - 228);
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('km/h', 1280 - 34, 720 - 228);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(p.vehicle.name, 1280 - 206, 720 - 228);
    if (p.vehicle.hp < 100) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(`DAMAGE ${Math.round(p.vehicle.hp)}%`, 1280 - 206, 720 - 246 + 34);
    }
  }
  drawMinimap(ctx, G);

  // Message feed, bottom-centre.
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  const feed = G.msgs.slice(-3);
  feed.forEach((m, i) => {
    const age = G.time - m.at;
    if (age > 6) return;
    ctx.globalAlpha = clamp(1.6 - age / 4, 0, 1);
    ctx.fillStyle = 'rgba(10,12,20,0.7)';
    const w = ctx.measureText(m.text).width + 20;
    ctx.beginPath();
    ctx.roundRect(640 - w / 2, 720 - 120 + i * 22 - 16, w, 20, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(m.text, 640, 720 - 120 + i * 22 - 2);
  });
  ctx.globalAlpha = 1;

  // Banner (job start / complete / failed).
  if (G.bannerText && G.time - G.bannerAt < 4) {
    ctx.globalAlpha = clamp(4.4 - (G.time - G.bannerAt), 0, 1);
    ctx.fillStyle = 'rgba(10,12,20,0.78)';
    ctx.beginPath();
    ctx.roundRect(340, 150, 600, 84, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(G.bannerText, 640, 186);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '14px sans-serif';
    wrapText(ctx, G.bannerSub || '', 640, 210, 560, 18);
    ctx.globalAlpha = 1;
  }

  // Shop prompt.
  const shop = nearShop(G);
  if (shop && G.screen === 'play') {
    ctx.fillStyle = 'rgba(10,12,20,0.78)';
    ctx.beginPath();
    ctx.roundRect(440, 300, 400, 110, 12);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(shop.name, 640, 326);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    const stock = SHOP_STOCK[shop.kind];
    stock.forEach((item, i) => {
      ctx.fillText(`[${i + 1}] ${item.name} — $${item.price}`, 640, 350 + i * 18);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('press 1 / 2 / 3 to buy, E to leave', 640, 350 + stock.length * 18 + 4);
  }

  // Controls hint, first minute of play.
  if (G.time < 45 && G.screen === 'play' && !G.story.active) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD move · E steal car · mouse aim + click shoot · SHIFT sprint · SPACE handbrake · M start job · P pause', 640, 700 - 128);
  }

  // Mute indicator.
  if (G.muted) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('MUTED (N)', 1264, 96);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export function drawTitle(ctx, G) {
  ctx.save();
  // Golden-hour sky gradient over the city backdrop (world already drawn).
  const sky = ctx.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, 'rgba(255,166,77,0.42)');
  sky.addColorStop(0.55, 'rgba(255,120,90,0.18)');
  sky.addColorStop(1, 'rgba(40,16,60,0.42)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.shadowColor = '#ff7a3c';
  ctx.shadowBlur = 30;
  ctx.font = 'bold 92px Georgia, serif';
  ctx.fillText('VELMARA', 640, 210);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '22px Georgia, serif';
  ctx.fillText('a golden-hour open-world crime story', 640, 252);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('Mara Voss owes fixer Tio Anselmo $10,000. Eight jobs. One city. No way out but through.', 640, 292);

  const has = G.hasSave;
  const items = [
    { key: '1', label: has ? 'Continue' : 'New Game', hint: has ? 'pick up where you left off' : 'start the story' },
    { key: '2', label: 'Free Roam', hint: 'the city, no debt, no heat' },
    { key: '3', label: 'How to play', hint: 'controls and systems' },
  ];
  items.forEach((it, i) => {
    const y = 360 + i * 62;
    ctx.fillStyle = 'rgba(10,12,20,0.72)';
    ctx.beginPath();
    ctx.roundRect(440, y - 28, 400, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`[${it.key}]`, 462, y + 4);
    ctx.fillStyle = '#fff';
    ctx.fillText(it.label, 510, y + 4);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '12px sans-serif';
    ctx.fillText(it.hint, 510, y + 22);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('an original game — city, characters, art and sound made for Velmara · nothing borrowed from any other game', 640, 580);
  ctx.fillText('WASD move · E steal · mouse aim · M start job · P pause · N mute', 640, 606);
  ctx.restore();
}

export function drawPause(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,16,0.66)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.fillText('PAUSED', 640, 220);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('S — save game      Q — quit to title      P / ESC — resume', 640, 268);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const done = G.jobDone.filter(Boolean).length;
  ctx.fillText(`Jobs done: ${done}/8   ·   Cash $${G.cash.toLocaleString('en-US')}   ·   Debt $${G.debt.toLocaleString('en-US')}`, 640, 306);
  if (G.savedFlash && G.time - G.savedFlash < 2) {
    ctx.fillStyle = '#7CFC66';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('saved', 640, 340);
  }
  ctx.restore();
}

export function drawHelp(ctx, G) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,16,0.82)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.fillText('HOW TO PLAY', 120, 110);
  const lines = [
    ['WASD / Arrows', 'move on foot, drive in a car'],
    ['E', 'steal the nearest car, exit a car, use a shop'],
    ['Mouse + Click', 'aim and shoot — gunfire raises heat'],
    ['SHIFT', 'sprint on foot'],
    ['SPACE', 'handbrake (drift)'],
    ['H', 'horn'],
    ['M', 'start / retry the current story job'],
    ['1 / 2 / 3', 'buy at a shop'],
    ['N', 'mute / unmute'],
    ['P / ESC', 'pause — S saves, Q quits to title'],
    ['', ''],
    ['WANTED', '0–5 stars. Stealing, hitting peds and shooting raise it.'],
    ['', 'VPD interceptors chase by road; roadblocks at 3+. Stay out of'],
    ['', 'sight to cool off. Busted or wasted costs 15% of your cash.'],
    ['', ''],
    ['MONEY', 'jobs pay the $10,000 debt. Gold bars ($150), taxi fares and'],
    ['', 'loot pay the rest. Shops: Marty’s (ammo / armor) and Rosa (repairs).'],
  ];
  ctx.font = '15px sans-serif';
  lines.forEach((row, i) => {
    const y = 150 + i * 26;
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(row[0], 140, y);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '15px sans-serif';
    ctx.fillText(row[1], 340, y);
  });
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px sans-serif';
  ctx.fillText('press 3 / ESC to go back', 140, 640);
  ctx.restore();
}

export function drawEnd(ctx, G, kind) {
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.textAlign = 'center';
  if (kind === 'win') {
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('KING OF VELMARA', 640, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    ctx.fillText('The debt is paid. The yacht is yours. The city is yours.', 640, 306);
    ctx.font = '15px sans-serif';
    ctx.fillText(`Cash $${G.cash.toLocaleString('en-US')}   ·   Gold ${G.stats.gold}/12   ·   Cars stolen ${G.stats.stolen}`, 640, 340);
    ctx.fillText('press ENTER for free roam, or Q for the title', 640, 380);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#9db8d6';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('BUSTED', 640, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('The VPD took 15% of your cash. Tio Anselmo is not pleased.', 640, 306);
    ctx.fillText('press ENTER to keep playing', 640, 350);
  } else {
    ctx.fillStyle = '#ff5d5d';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.fillText('WASTED', 640, 260);
    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText('Mara is down. The VPD took 15% of your cash.', 640, 306);
    ctx.fillText('press ENTER to keep playing', 640, 350);
  }
  ctx.restore();
}

export { JOBS };
