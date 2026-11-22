// side.js — side money: hidden gold bars, taxi fares and the two shops.
// Nothing here touches the story runner; story.js owns job state.

import { dist, makeRng } from './rng.js';
import { burst } from './traffic.js';

export function stepGold(G) {
  const p = G.player;
  for (const g of G.world.goldSpots) {
    if (g.taken) continue;
    if (dist(p.x, p.y, g.x, g.y) < 34) {
      g.taken = true;
      G.stats.gold += 1;
      G.addCash(150, 'gold bar');
      G.sound.pickup();
      burst(G, g.x, g.y, '#ffd23e', 14);
      G.msg(`gold bar — $150 (${G.stats.gold}/12 found)`);
    }
  }
}

// Taxi: hail a fare (walk up to a waiting rider), drive them to the pin,
// get paid + tipped. Fares also count toward job 6.
export function startFare(G) {
  const rng = makeRng((Math.random() * 1e9) | 0);
  const w = G.world;
  const px = w.roadsX[Math.floor(rng.next() * w.roadsX.length)];
  const py = w.roadsY[Math.floor(rng.next() * w.roadsY.length)];
  const dx = w.roadsX[Math.floor(rng.next() * w.roadsX.length)];
  const dy = w.roadsY[Math.floor(rng.next() * w.roadsY.length)];
  G.taxi = {
    active: true,
    phase: 'pickup',
    px: px + rng.range(-30, 30),
    py: py + rng.range(-30, 30),
    dx,
    dy,
    fare: 60 + Math.floor(rng.next() * 90),
    timer: 150,
  };
  G.msg('taxi fare waiting — pick them up');
}

export function stepTaxi(G, dt) {
  const t = G.taxi;
  if (!t || !t.active) return;
  const p = G.player;
  t.timer -= dt;
  if (t.timer <= 0) {
    G.msg('fare cancelled — too slow');
    G.taxi = { active: false };
    return;
  }
  if (t.phase === 'pickup') {
    if (dist(p.x, p.y, t.px, t.py) < 46) {
      if (!p.vehicle) {
        G.msg('you need a car for the fare');
        return;
      }
      t.phase = 'dropoff';
      G.msg('rider in — drive to the pin');
      G.sound.pickup();
    }
  } else if (dist(p.x, p.y, t.dx, t.dy) < 56) {
    const tip = Math.floor(t.fare * 0.25);
    G.addCash(t.fare + tip, 'taxi fare');
    G.sound.cash();
    G.msg(`fare done — $${t.fare} + $${tip} tip`);
    G.stats.fares += 1;
    if (G.story.onFareDone) G.story.onFareDone(G);
    G.taxi = { active: false };
  }
}

export function nearShop(G) {
  const p = G.player;
  for (const s of G.world.shops) {
    if (dist(p.x, p.y, s.x, s.y) < 70) return s;
  }
  return null;
}

export const SHOP_STOCK = {
  guns: [
    { id: 'ammo', name: 'Pistol ammo +60', price: 80, run: (G) => { G.player.reserve += 60; } },
    { id: 'vest', name: 'Body armor', price: 250, run: (G) => { G.player.armor = 100; } },
    { id: 'meds', name: 'Patch up (+50 HP)', price: 120, run: (G) => { G.player.hp = Math.min(100, G.player.hp + 50); } },
  ],
  repair: [
    { id: 'fix', name: 'Repair your car', price: 150, run: (G) => { if (G.player.vehicle) { G.player.vehicle.hp = 100; G.player.vehicle.smoke = 0; } } },
    { id: 'tune', name: 'Tune-up (+top speed)', price: 300, run: (G) => { if (G.player.vehicle) G.player.vehicle.top += 25; } },
  ],
};

export function buyFromShop(G, shop, itemId) {
  const item = (SHOP_STOCK[shop.kind] || []).find((i) => i.id === itemId);
  if (!item) return false;
  if (G.cash < item.price) {
    G.msg('not enough cash');
    return false;
  }
  if (shop.kind === 'repair' && !G.player.vehicle) {
    G.msg('bring a car to Rosa first');
    return false;
  }
  G.cash -= item.price;
  item.run(G);
  G.sound.cash();
  G.msg(`bought ${item.name} — $${item.price}`);
  return true;
}
