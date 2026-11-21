# VELMARA — a golden-hour open-world crime game

**Bounty:** make.fun `gta6-01` — "Make GTA 6" ($1,666, top 100 paid, deadline 24 Nov 2026 22:00 WIB)
**Proposed submission title:** `VELMARA: Golden-Hour Open-World Crime — 8 story jobs, 5-star wanted, drive + steal + fight`

An original sun-soaked canal city at golden hour. Mara Voss, wheelwoman new
to Velmara, owes fixer Tio Anselmo $10,000. Eight story jobs pay the debt
down — steal, courier, collect, escape, ambush, taxi nights, a bank job, and
a final shootout at the docks. When the debt is gone, Velmara is yours.

Nothing in this game comes from any commercial game: the city, characters,
vehicles, names, story, art, sound and music are all original, drawn and
synthesized in code. No Rockstar names, logos, characters, maps or assets.

## Play it

```sh
node serve.ts        # then open http://localhost:8080
```

Static files only — `game/index.html` opens in desktop Chrome and plays
with zero network requests, zero libraries, zero build step.

## Controls

| Input | Action |
|---|---|
| WASD / Arrows | Move on foot, drive in a car |
| E | Enter / steal the nearest car, exit a car, use a shop |
| Mouse + Click | Aim and shoot (costs ammo, makes noise, makes heat) |
| SHIFT | Sprint on foot |
| SPACE | Handbrake |
| H | Horn |
| M | Start / retry the current story job |
| N | Mute / unmute sound |
| P / ESC | Pause (S saves, Q quits to title) |

## Systems (all live, all wired together)

- **City** — 2,880 × 2,160 open world, 7 districts (Old Town, Canal Row,
  Neon Strip, Hillcrest, Marina, Portside, Beachfront), a canal with two
  bridges, a marina with boats, a beach with surf, 62 extruded 2.5D
  buildings with long golden-hour shadows, neon signs, palms, parks.
- **Driving** — arcade car physics (accel, speed-scaled steering,
  handbrake drift, damage + smoke), 7 vehicle types, parked cars and
  live traffic that follows the road grid.
- **Stealing** — take any parked or traffic car with E; stealing is a crime.
- **Wanted** — 0–5 stars. Stealing, hitting pedestrians, shooting and
  killing officers raise it. VPD interceptors chase by road routing, foot
  officers close in, roadblocks at 3+. Stay out of sight to cool off.
  Busted (caught on foot) or wasted (health 0) costs 15% of your cash.
- **Missions + story** — 8 jobs with briefing text, objective tracker,
  map beacon + edge arrow + distance, timers, payouts that pay down the
  $10,000 debt, and a win screen when the story ends.
- **Combat** — mouse-aim pistol, bullets with tracers, muzzle flash,
  rival gang members who approach, strafe and shoot back, particles,
  screen shake, health regen after a quiet spell.
- **Economy** — mission payouts, 12 hidden gold bars ($150 each), taxi
  fares, two shops (Marty's Guns & Meds: ammo/vest/patch-up; Rosa Auto
  Repair: fix your car), cash stashes.
- **HUD + minimap** — cash + debt, wanted stars, clock, objective
  tracker, health/armor, speedometer, live minimap (city, mission target,
  police, enemies, gold), message feed, mission banners.
- **Save** — autosaves after every completed job; Continue on the title
  screen; manual save from pause.
- **Sound** — 100% synthesized WebAudio: engine hum, two-tone sirens,
  gunshots, crashes, pickups, mission stings, and a looping golden-hour
  groove (bass + pad + hats). N mutes/unmutes. Sound starts on first
  click/key (browser autoplay policy).

## Files

```
main.ts            Node 22 program: copies game/ + screenshots/ to /output,
                   writes /output/dossier.json with vendor/makefun-game.ts
game/index.html    the game shell (canvas 1280x720)
game/src/main.js       boot, loop, screens, stealing, saving
game/src/city.js       Velmara: districts, buildings, canal, beach
game/src/render.js     2.5D golden-hour renderer + live minimap
game/src/hud.js        HUD, objective tracker, menus, end screens
game/src/player.js     Mara on foot and in a car
game/src/vehicles.js   car physics, traffic AI, police pursuit driving
game/src/police.js     wanted system, VPD force, busted/wasted
game/src/peds.js       pedestrians (stroll, flee gunfire)
game/src/combat.js     bullets, enemies, particles
game/src/missions.js   the 8-job story + mission runner
game/src/economy.js    gold bars, taxi fares, shops
game/src/audio.js      synthesized WebAudio SFX + music
game/src/input.js      keyboard + mouse
game/src/save.js       localStorage save/load
game/src/shots.js      deterministic screenshot scenes (?shot=…)
game/src/selftest.js   18 headless logic checks (?selftest=1)
game/src/util.js       seeded RNG, math, collision
screenshots/          4 real renders of the game's own code, 1280x720
test-game.mjs          node verification (determinism + gate self-checks)
```

## Verification (all done 21 Nov 2026, WIB)

- Headless self-test `?selftest=1`: **18/18 PASS** — deterministic city,
  mission 1 completion, wanted raise + cool-off, target-car steal, bullet
  hits, gold payout, shop sale, taxi pickup + dropoff, 5s traffic sim,
  busted check, save/load round-trip, render smoke test, and a scripted
  **full 8-mission story playthrough: 8/8 complete, debt $10,000 → $2,050,
  cash $250 → $9,224**.
- `node test-game.mjs`: **15/15 PASS** — `main.ts` run twice writes
  byte-identical output (23 files), game/ 18 files / 124.7 KiB, index.html
  649 B, 4 screenshots 73–113 KiB each, no network references, dossier
  653 KiB (cap 1.5 MiB).
- Plain load in headless Chromium: **no console errors**.
- Screenshots visually inspected: title, driving on the Neon Strip,
  3-star VPD chase, dockside shootout — each shows the HUD, minimap,
  objective tracker and at least two systems at once.

## Screenshots

1. `1-title.jpg` — title screen, story hook, menu.
2. `2-drive.jpg` — driving the yellow Veloce GT on the Neon Strip, job 1
   active, traffic, canal, minimap, 237 km/h.
3. `3-chase.jpg` — 3-star MANHUNT, two VPD interceptors on the tail,
   objective beacon over the yellow GT, 209 km/h.
4. `4-mission.jpg` — dockside ambush on foot: Marlin crew shooting,
   tracers, HP bars, ammo 43/120, HP 73, wanted 2 stars.

## License

MIT — see LICENSE.
