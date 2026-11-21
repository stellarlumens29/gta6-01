// VELMARA — util.js: seeded RNG, math helpers, collision primitives.
// All world generation and traffic use the seeded RNG so a seed always
// rebuilds the same city, the same traffic and the same screenshot scenes.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; }
export function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
/** Shortest signed turn from angle a toward angle b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }
export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

/** Circle vs axis-aligned box: push the circle out, return penetration depth (0 = no hit). */
export function circleVsBox(cx, cy, r, box) {
  const nx = clamp(cx, box.x, box.x + box.w);
  const ny = clamp(cy, box.y, box.y + box.h);
  const dx = cx - nx, dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return 0;
  return r - Math.sqrt(d2);
}

/** Resolve a circle against a list of boxes in place; returns true if any hit. */
export function resolveCircleVsBoxes(pos, r, boxes) {
  let hit = false;
  for (let i = 0; i < boxes.length; i += 1) {
    const b = boxes[i];
    const nx = clamp(pos.x, b.x, b.x + b.w);
    const ny = clamp(pos.y, b.y, b.y + b.h);
    let dx = pos.x - nx, dy = pos.y - ny;
    let d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 0.0001) {
      // Centre inside the box: push out along the smallest exit.
      const left = pos.x - b.x, right = b.x + b.w - pos.x;
      const top = pos.y - b.y, bottom = b.y + b.h - pos.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = b.x - r;
      else if (m === right) pos.x = b.x + b.w + r;
      else if (m === top) pos.y = b.y - r;
      else pos.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      pos.x += dx * push; pos.y += dy * push;
    }
  }
  return hit;
}

export function formatMoney(n) {
  const v = Math.floor(n);
  return '$' + v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function formatClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}
