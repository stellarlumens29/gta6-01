# VELMARA — submission dossier (gta6-01)

## What it is

A complete, original, static-browser open-world crime game. One city,
one story, every genre system wired together and shown in the screenshots.

**Title for submission:** `VELMARA: Golden-Hour Open-World Crime — 8 story jobs, 5-star wanted, drive + steal + fight`

## The city

Velmara is a sun-soaked canal city at golden hour — not another midday
beach town. Seven named districts (Old Town, Canal Row, Neon Strip,
Hillcrest, Marina, Portside, Beachfront), a canal with two bridges, a
marina with boats, a beach with animated surf, 62 extruded 2.5D buildings
with long east shadows and lit windows, neon signs (HOTEL LUNA, BAR NEON,
CASINO SOL, CLUB MAREA, TACOS 24H, CINE ORO), palms, parks and a plaza.
The 2.5D look (roof + two shaded faces + shadow per building) reads as a
real place at thumbnail size, where flat top-down cities read as diagrams.

## The story

Mara Voss, wheelwoman new to Velmara, owes fixer Tio Anselmo $10,000.
Eight jobs pay it down:

| # | Job | What you do | Payout |
|---|---|---|---|
| 1 | First Wheels | Steal any car, drive to the Marina | $300 |
| 2 | The Courier | Pick up at Plaza del Sol, deliver to the docks in 100s | $450 |
| 3 | Cash Run | Collect 5 stashes around Old Town | $500 |
| 4 | Hot Wheels | Steal the yellow Veloce GT, lose the heat | $700 |
| 5 | Dockside Deal | Meet the buyer, survive a 4-shooter ambush, get home | $900 |
| 6 | Taxi Nights | 3 fares in 4 minutes | $800 |
| 7 | The Vault Job | Hold the bank vault 25s under alarm, escape at ≤1 star | $1,800 |
| 8 | King of Velmara | 6-shooter dock shootout, take the yacht | $2,500 |

Debt $10,000 → $2,050 across the 8 jobs; the rest comes from side money
(gold bars, fares, loot), and the win screen fires when the story ends.

## Every required system, and where to see it

| Requirement | Implementation | Screenshot |
|---|---|---|
| City on foot and by car | 2,880×2,160 world, WASD walk/sprint + arcade driving (accel, steering, handbrake, damage) | 2, 3, 4 |
| Traffic and pedestrians | 10 traffic cars on the road grid, 26 peds who stroll and flee gunfire | 2, 3, 4 |
| Cars to steal | 16 parked + traffic cars, E to steal (a crime); 7 vehicle types | 2, 3 |
| Wanted level and police | 0–5 stars, VPD interceptors (road-routed pursuit), foot officers, roadblocks at 3+, cool-off hiding, busted/wasted | 3, 4 |
| Missions and a story | 8 jobs, briefings, objective tracker, beacon + edge arrow + distance | 2, 3, 4 |
| Combat | Mouse-aim pistol, tracers, enemies who strafe and shoot back, HP bars | 4 |
| HUD with a minimap | Cash/debt, stars, clock, objective, health/armor, speed, live minimap | 2, 3, 4 |
| Start and a save | Title (New/Continue/Help/Free Roam), autosave per job, pause-menu save | 1 |
| Polish | Golden-hour wash + vignette, headlight cones, particles, screen shake, synthesized music + SFX, mute | all |

## Side content

12 hidden gold bars ($150 each), taxi fares (pickup → dropoff, paid +
tipped), two shops (Marty's Guns & Meds, Rosa Auto Repair), cash stashes,
free roam after the story.

## Field check (21 Nov 2026, live API)

- Bounty open, `acceptingSubmissions: true`, 13,423 submissions, deadline
  24 Nov 2026 15:00 UTC. Our handle has 0 submissions so far.
- Top of the field (~994k) is dominated by 3D sun-soaked coastal cities
  with 8–10 story missions and named police dispatch systems, mostly
  named Solmar Bay / Neon Harbor / Palmera Heat / Bahia Celeste.
- Differentiators in this entry: golden-hour dusk art direction (warm
  wash, long shadows, neon) instead of flat midday beach; a canal city
  (water + bridges + marina + beach in one map) instead of a beach strip;
  a debt-driven story with a named fixer and a named rival crew; every
  screenshot shows 2+ systems at once (chase + wanted + minimap +
  objective, shootout + HP + ammo + wanted).

## Verification evidence

- `?selftest=1` in headless Chromium: **18/18 PASS**, including a
  scripted full 8-mission playthrough (8/8 complete, debt $10,000 →
  $2,050, cash $250 → $9,224).
- `node test-game.mjs`: **15/15 PASS** — main.ts twice byte-identical
  (23 files), game/ 18 files / 124.7 KiB, index.html 649 B, 4 screenshots
  1280x720 JPEG 73–113 KiB, zero network references, dossier 653 KiB.
- Plain load: no console errors. All 4 screenshots visually inspected
  by the builder (see README.md for the shot-by-shot description).

## Known limits (honest)

- 2.5D canvas, not true 3D — a deliberate trade: a verified, complete
  2.5D game beats an unverified 3D one, and the field's 3D entries are
  the bar this entry answers with density + art direction instead.
- Traffic has no traffic lights; police pursuit is road-grid routing,
  not full pathfinding — it can take a wrong turn for a block and recover.
- Music is a 16-step loop (bass + pad + hats), not a composed score.
- No mute key was in v1 of the build; N was added after the screenshot
  pass (README + code updated, self-test re-run — screenshots unaffected
  since no shot shows the mute state).

## How to submit (for the submitting session — see HANDOFF.md)

DO NOT run the make.fun kit CLI bundle/check/submit flow in this batch —
it is flagged on an execution-risk check and there is no go-ahead for it.
This build is repo-ready only. The submitting session must re-author it
in a recorded session first (transcript gate), then follow the user's
submit decision.
