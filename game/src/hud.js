// VELMARA — hud.js: the HUD (cash, debt, health, armor, ammo, wanted
// stars, clock, objective tracker, speed, minimap frame, message feed)
// and every menu screen: title, how-to-play, pause, busted, wasted, win.
import { VIEW_W, VIEW_H, drawMinimap } from './render.js';
import { formatMoney, formatClock, clamp } from './util.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_WIN = 'win';
export const SCREEN_HELP = 'help';

export function drawHUD(ctx, game) {
  const p = game.player;
  // Top-left: cash + debt.
  panel(ctx, 14, 12, 250, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(formatMoney(p.cash), 26, 38);
  ctx.fillStyle = game.debt > 0 ? '#ffb3b3' : '#8affb0';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(game.debt > 0 ? 'DEBT TO TIO: ' + formatMoney(game.debt) : 'DEBT PAID — VELMARA IS YOURS', 26, 60);
  // Top-centre: objective tracker.
  const obj = game.missions.objectiveText();
  const w = ctx.measureText(obj).width + 60;
  panel(ctx, VIEW_W / 2 - w / 2, 12, w, 34);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JOB ' + Math.min(game.missions.index + 1, MISSIONS.length) + '/' + MISSIONS.length + ' — ' + (game.missions.current() ? game.missions.current().title.toUpperCase() : 'FREE ROAM'), VIEW_W / 2, 35);
  // Objective detail line under the tracker.
  ctx.fillStyle = 'rgba(10,8,20,0.6)';
  const ow = ctx.measureText(obj).width + 24;
  ctx.fillRect(VIEW_W / 2 - ow / 2, 50, ow, 22);
  ctx.fillStyle = '#ffe9b8';
  ctx.fillText(obj, VIEW_W / 2, 65);
  // Top-right: wanted stars + clock.
  const stars = game.wanted.stars;
  panel(ctx, VIEW_W - 230, 12, 216, 64);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(game.wanted.label().toUpperCase(), VIEW_W - 218, 32);
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd23f' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, VIEW_W - 218 + i * 26, 52, 9);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('18:' + String(40 + Math.floor(game.now / 60) % 20).padStart(2, '0') + '  GOLDEN HOUR', VIEW_W - 218, 68);
  // Bottom-left: minimap + health/armor.
  drawMinimap(ctx, game, 18, VIEW_H - 178, 220, 165);
  // Health bar above the minimap.
  ctx.fillStyle = 'rgba(10,8,20,0.72)';
  ctx.fillRect(14, VIEW_H - 206, 228, 22);
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(20, VIEW_H - 201, 120, 12);
  ctx.fillStyle = p.health > 30 ? '#4ade80' : '#ff4d4d';
  ctx.fillRect(20, VIEW_H - 201, 120 * clamp(p.health / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('HP ' + Math.ceil(p.health), 146, VIEW_H - 191);
  if (p.armor > 0) {
    ctx.fillStyle = '#7ab8ff';
    ctx.fillRect(20, VIEW_H - 201, 120 * clamp(p.armor / 100, 0, 1), 4);
  }
  // Bottom-right: speed + vehicle / ammo.
  panel(ctx, VIEW_W - 230, VIEW_H - 96, 216, 82);
  ctx.textAlign = 'left';
  if (!p.onFoot && p.car) {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(Math.round(p.speedKmh) + ' km/h', VIEW_W - 218, VIEW_H - 62);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(p.car.name + '  •  HP ' + Math.ceil(p.car.health) + '%', VIEW_W - 218, VIEW_H - 40);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.fillText('E exit  •  SPACE handbrake  •  H horn', VIEW_W - 218, VIEW_H - 24);
  } else {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ON FOOT', VIEW_W - 218, VIEW_H - 62);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText('Ammo ' + p.ammo + ' / ' + p.maxAmmo + '  •  Click to shoot', VIEW_W - 218, VIEW_H - 40);
    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.fillText('E steal car  •  SHIFT sprint  •  M job', VIEW_W - 218, VIEW_H - 24);
  }
  // Message feed (bottom-centre).
  ctx.textAlign = 'center';
  let my = VIEW_H - 120;
  for (let i = game.messages.length - 1; i >= 0; i -= 1) {
    const m = game.messages[i];
    ctx.globalAlpha = clamp(m.life / 2, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(m.text, VIEW_W / 2, my);
    my -= 20;
  }
  ctx.globalAlpha = 1;
  // Mission banner.
  if (game.missions.bannerTimer > 0) {
    ctx.globalAlpha = clamp(game.missions.bannerTimer, 0, 1);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(game.missions.banner, VIEW_W / 2, VIEW_H / 2 - 120);
    ctx.globalAlpha = 1;
  }
  // Wanted flash when stars rise.
  if (game.wantedFlash > 0) {
    ctx.globalAlpha = game.wantedFlash * 0.5;
    ctx.fillStyle = '#ff2e4d';
    ctx.fillRect(0, 0, VIEW_W, 10);
    ctx.fillRect(0, VIEW_H - 10, VIEW_W, 10);
    ctx.globalAlpha = 1;
  }
  // Objective direction arrow at the screen edge.
  const t = game.missions.target();
  if (t) drawEdgeArrow(ctx, game, t);
  ctx.textAlign = 'left';
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,8,20,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,210,63,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
}

function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawEdgeArrow(ctx, game, t) {
  const p = game.player;
  const dx = t.x - p.x, dy = t.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 260) return;
  const cam = game.camera;
  const sx = t.x - cam.x, sy = t.y - cam.y;
  if (sx > 60 && sx < VIEW_W - 60 && sy > 60 && sy < VIEW_H - 60) return;
  const cx = clamp(sx, 70, VIEW_W - 70);
  const cy = clamp(sy, 90, VIEW_H - 90);
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(d) + 'm', cx, cy + 26);
  ctx.textAlign = 'left';
}

/* ------------------------------ screens ------------------------------ */

function screenBase(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#2b1038');
  g.addColorStop(0.55, '#7a2d4d');
  g.addColorStop(1, '#e8703a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // Sun.
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.arc(VIEW_W - 260, 150, 64, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,210,63,0.35)';
  ctx.beginPath(); ctx.arc(VIEW_W - 260, 150, 92, 0, Math.PI * 2); ctx.fill();
  // Skyline silhouettes.
  ctx.fillStyle = 'rgba(30,10,40,0.85)';
  let x = 0;
  const heights = [120, 200, 150, 240, 180, 260, 140, 210, 170, 230, 130, 190];
  for (let i = 0; i < heights.length; i += 1) {
    ctx.fillRect(x, VIEW_H - 190 - heights[i], 108, heights[i] + 190);
    x += 108;
  }
  ctx.fillStyle = 'rgba(255,210,63,0.9)';
  for (let i = 0; i < 60; i += 1) {
    const wx = (i * 197) % VIEW_W, wy = VIEW_H - 180 + ((i * 89) % 150);
    ctx.fillRect(wx, wy, 5, 7);
  }
}

function titleText(ctx, game) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText('VELMARA', VIEW_W / 2, 210);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('A GOLDEN-HOUR OPEN-WORLD CRIME GAME', VIEW_W / 2, 252);
  ctx.fillStyle = '#ffe9b8';
  ctx.font = '16px sans-serif';
  ctx.fillText('Mara Voss owes fixer Tio Anselmo $10,000. Eight jobs. One city. No way out but through.', VIEW_W / 2, 284);
  ctx.fillText('Steal cars  •  Outrun the VPD  •  Run jobs  •  Pay the debt  •  Own the city', VIEW_W / 2, 310);
  ctx.textAlign = 'left';
}

export function drawTitle(ctx, game) {
  screenBase(ctx);
  titleText(ctx, game);
  ctx.textAlign = 'center';
  const has = game.hasSave;
  const items = [
    (has ? 'CONTINUE  —  Job ' + (game.saveData ? game.saveData.missionIndex + 1 : 1) + ' of 8' : 'NEW GAME'),
    'HOW TO PLAY',
    'FREE ROAM (no jobs, just the city)',
  ];
  ctx.font = 'bold 22px sans-serif';
  items.forEach((s, i) => {
    const y = 400 + i * 46;
    ctx.fillStyle = i === game.menuIndex ? '#ffd23f' : '#fff';
    if (i === game.menuIndex) ctx.fillText('▸ ' + s, VIEW_W / 2, y);
    else ctx.fillText(s, VIEW_W / 2, y);
  });
  ctx.fillStyle = '#ffb3c8';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive  •  E enter & steal cars  •  Mouse aim, Click shoot  •  M start job  •  P pause  •  Click a menu item or press Enter', VIEW_W / 2, 560);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '13px sans-serif';
  ctx.fillText('An original game — city, characters, vehicles, story, art and music are all our own. Nothing from any commercial game.', VIEW_W / 2, 600);
  ctx.fillText('Headphones on: the whole soundtrack is synthesized live. No network, no downloads.', VIEW_W / 2, 622);
  ctx.textAlign = 'left';
}

export function drawHelp(ctx, game) {
  screenBase(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('HOW TO PLAY', VIEW_W / 2, 120);
  ctx.fillStyle = '#fff';
  ctx.font = '17px sans-serif';
  const lines = [
    'WASD / Arrows — move on foot, drive in a car',
    'E — enter the nearest car, steal a parked or traffic car',
    'Mouse — aim   •   Click — shoot (costs ammo, makes noise, makes heat)',
    'SHIFT — sprint on foot   •   SPACE — handbrake   •   H — horn',
    'M — start / retry the current story job   •   P / ESC — pause',
    'Wanted stars — crimes raise them; stay out of sight to cool off',
    'Busted — an officer touches you on foot   •   Wasted — your health hits zero',
    'Shops — Marty\'s Guns & Meds sells ammo, vests and patch-ups; Rosa fixes cars',
    'Gold bars — 12 hidden around the city, $150 each   •   Taxi fares pay per trip',
    'Your progress autosaves after every completed job.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 180 + i * 34));
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ESC or click to go back', VIEW_W / 2, 580);
  ctx.textAlign = 'left';
}

export function drawPaused(ctx, game) {
  ctx.fillStyle = 'rgba(10,6,20,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Job ' + (game.missions.index + 1) + ' of 8 — ' + (game.missions.current() ? game.missions.current().title : 'Story complete'), VIEW_W / 2, 310);
  ctx.fillText('Cash ' + formatMoney(game.player.cash) + '   •   Debt ' + formatMoney(game.debt) + '   •   Gold ' + game.goldFound + '/12', VIEW_W / 2, 340);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('P / ESC resume  •  S save now  •  Q quit to title', VIEW_W / 2, 420);
  ctx.textAlign = 'left';
}

function endScreen(ctx, title, color, lines, footer) {
  ctx.fillStyle = 'rgba(10,6,20,0.88)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '19px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 320 + i * 34));
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(footer, VIEW_W / 2, 520);
  ctx.textAlign = 'left';
}

export function drawBusted(ctx, game) {
  endScreen(ctx, 'BUSTED', '#7ab8ff', [
    'The VPD took you in. They kept 15% of your cash (' + formatMoney(game.lastPenalty) + ').',
    'Tio is not impressed. The debt is still ' + formatMoney(game.debt) + '.',
  ], 'Press ENTER to walk out of VPD HQ and keep playing');
}

export function drawWasted(ctx, game) {
  endScreen(ctx, 'WASTED', '#ff4d4d', [
    'St. Alba Hospital patched you up — and billed you 15% of your cash (' + formatMoney(game.lastPenalty) + ').',
    'The city does not wait. Neither does the debt: ' + formatMoney(game.debt) + '.',
  ], 'Press ENTER to leave the hospital and keep playing');
}

export function drawWin(ctx, game) {
  screenBase(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('KING OF VELMARA', VIEW_W / 2, 220);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('The debt is paid. The Marlin crew is finished. The yacht is yours.', VIEW_W / 2, 272);
  ctx.font = '18px sans-serif';
  ctx.fillText('Jobs completed: ' + game.missions.completedCount + ' / 8', VIEW_W / 2, 330);
  ctx.fillText('Cash: ' + formatMoney(game.player.cash) + '   •   Time in the city: ' + formatClock(game.now), VIEW_W / 2, 362);
  ctx.fillText('Gold bars found: ' + game.goldFound + ' / 12   •   Cars stolen: ' + game.carsStolen, VIEW_W / 2, 394);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('Press ENTER for free roam — Velmara is yours now', VIEW_W / 2, 480);
  ctx.textAlign = 'left';
}
