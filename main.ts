// VELMARA hand-in program — main.ts (Node 22, standard library only).
//
// What it does, in order:
//   1. copies this repo's game/ (plain static files, no build step) to the
//      output directory, so the grader can serve it as-is;
//   2. copies screenshots/ beside it (the first file by name is the cover);
//   3. writes dossier.json with buildDossier from vendor/makefun-game.ts,
//      the summary the judge reads.
//
// The grader runs this in a fresh container with /output writable and the
// repo read-only. Locally, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Caps passed to buildDossier mirror the scorer's own limits, so a build
// that passes here will not trip the gate for size: at most 4 screenshots
// of 256 KiB, at most 993 game files / 48 MiB, paths under 1000 bytes,
// and the dossier text capped at 160 KiB.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('VELMARA: game/index.html is missing — nothing to hand in');
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
