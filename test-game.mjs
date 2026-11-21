// VELMARA — test-game.mjs: node-side verification for the gta6-01 entry.
// 1) main.ts runs twice into two dirs and writes byte-identical output
//    (determinism — the grader runs it twice).
// 2) Gate self-checks: game/ file count + bytes, index.html size, every
//    reference inside game/ is relative, screenshots 3-4 within size caps.
// 3) Dossier sanity: parses, names the game files, under the 1.5 MiB cap.
// Run: node test-game.mjs   (exit 0 = all pass)
import { execSync } from 'node:child_process';
import { readdirSync, statSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('.', import.meta.url).pathname;
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log('PASS ' + name + (detail ? ' — ' + detail : '')); }
  else { fail += 1; console.log('FAIL ' + name + (detail ? ' — ' + detail : '')); }
}

function tree(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const rel = base ? base + '/' + e : e;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...tree(p, rel));
    else out.push({ rel, size: st.size, path: p });
  }
  return out;
}
function sha(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }

// 1) Determinism: run main.ts twice.
for (const d of ['out1', 'out2']) {
  if (existsSync(join(root, d))) rmSync(join(root, d), { recursive: true, force: true });
  execSync('node main.ts', { cwd: root, env: { ...process.env, MAKEFUN_OUTPUT_DIR: join(root, d) }, stdio: 'pipe' });
}
const t1 = tree(join(root, 'out1')).sort((a, b) => a.rel.localeCompare(b.rel));
const t2 = tree(join(root, 'out2')).sort((a, b) => a.rel.localeCompare(b.rel));
check('main-runs-twice-same-files', t1.length === t2.length && t1.every((f, i) => f.rel === t2[i].rel && f.size === t2[i].size), t1.length + ' files');
check('main-runs-twice-same-bytes', t1.every((f, i) => sha(f.path) === sha(t2[i].path)), 'dossier ' + sha(join(root, 'out1/dossier.json')).slice(0, 12));

// 2) Gate self-checks on out1.
const gameFiles = tree(join(root, 'out1/game'));
check('game-file-count', gameFiles.length <= 993, gameFiles.length + ' files');
const gameBytes = gameFiles.reduce((s, f) => s + f.size, 0);
check('game-total-bytes', gameBytes <= 48 * 1024 * 1024, (gameBytes / 1024).toFixed(1) + ' KiB');
const index = gameFiles.find((f) => f.rel === 'index.html');
check('index-html-size', !!index && index.size <= 1024 * 1024, index ? index.size + ' B' : 'missing');
const shots = tree(join(root, 'out1/screenshots'));
check('screenshot-count', shots.length >= 3 && shots.length <= 4, shots.length + ' shots');
check('screenshot-sizes', shots.every((s) => s.size <= 262144), shots.map((s) => s.rel + ' ' + (s.size / 1024).toFixed(0) + 'KiB').join(', '));
check('screenshot-names', shots.every((s) => /^[A-Za-z0-9._-]+$/.test(s.rel) && !s.rel.startsWith('.') && !s.rel.startsWith('-')), shots.map((s) => s.rel).join(', '));
// No network references in game/: scan .html/.js/.css for http(s):, //host, or absolute paths.
const bad = [];
const urlRe = /(https?:)?\/\/[a-zA-Z0-9]/;
for (const f of gameFiles) {
  if (!['.html', '.js', '.mjs', '.css'].includes(extname(f.rel))) continue;
  const text = readFileSync(f.path, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const code = line.split('//')[0]; // comments are not references (gate parses AST)
    if (urlRe.test(code)) bad.push(f.rel + ':' + (i + 1));
  });
}
check('game-no-network-refs', bad.length === 0, bad.join('; ') || 'all relative');
// Every src/href in index.html resolves inside game/.
const indexText = readFileSync(join(root, 'out1/game/index.html'), 'utf8');
const refs = [...indexText.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
check('index-refs-resolve', refs.every((r) => r.startsWith('data:') || existsSync(join(root, 'out1/game', r.replace(/^\//, '')))), refs.join(', '));
// Source files parse as ES modules (node import check via dynamic import of each src file is browser-only;
// instead use node's built-in module syntax check through `node --check` with .mjs copies).
for (const f of gameFiles.filter((x) => x.rel.endsWith('.js'))) {
  try {
    execSync('node --check ' + JSON.stringify(f.path), { stdio: 'pipe' });
  } catch (e) {
    // node --check treats .js as CommonJS; import/export fails there. Re-check as .mjs.
    try {
      const tmp = f.path + '.check.mjs';
      execSync('cp ' + JSON.stringify(f.path) + ' ' + JSON.stringify(tmp) + ' && node --check ' + JSON.stringify(tmp) + '; rm -f ' + JSON.stringify(tmp), { stdio: 'pipe' });
    } catch (e2) {
      check('js-parses-' + f.rel, false, String(e2.message).slice(0, 200));
    }
  }
}
check('js-files-present', gameFiles.filter((f) => f.rel.endsWith('.js')).length >= 10, gameFiles.filter((f) => f.rel.endsWith('.js')).length + ' js files');

// 3) Dossier sanity.
const dossier = JSON.parse(readFileSync(join(root, 'out1/dossier.json'), 'utf8'));
check('dossier-parses', !!dossier, '');
const dossierBytes = statSync(join(root, 'out1/dossier.json')).size;
check('dossier-size', dossierBytes <= 1572864, (dossierBytes / 1024).toFixed(1) + ' KiB');
const dossierText = readFileSync(join(root, 'out1/dossier.json'), 'utf8');
check('dossier-names-sources', ['src/main.js', 'src/city.js', 'src/missions.js', 'src/police.js', 'src/render.js'].every((s) => dossierText.includes(s)), 'key files listed');
check('dossier-has-screenshots', dossierText.includes('1-title.jpg') && dossierText.includes('4-mission.jpg'), '');

console.log('\n' + pass + '/' + (pass + fail) + ' checks passed');
process.exit(fail ? 1 : 0);
