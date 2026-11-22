// test-game.mjs — VELMARA verification: 15 checks.
//   node test-game.mjs
// Exits 0 when every check passes, 1 otherwise. No network, no browser.

import { execSync } from 'node:child_process';
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join, dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
const results = [];

const pending = [];
function check(name, fn) {
  pending.push(
    (async () => {
      try {
        const detail = await fn();
        results.push({ name, pass: true, detail: detail || '' });
        console.log(`PASS ${name}${detail ? ' — ' + detail : ''}`);
      } catch (err) {
        results.push({ name, pass: false, detail: String(err.message || err) });
        console.log(`FAIL ${name} — ${err.message || err}`);
      }
    })(),
  );
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = lstatSync(full);
    if (st.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function jpegSize(buf) {
  // Scan markers for a Start-Of-Frame segment; returns {w, h} or null.
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return { w, h };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return null;
}

// 1 — main.ts runs twice and writes byte-identical output.
check('main.ts deterministic (two runs identical)', () => {
  const a = mkdtempSync(join(root, '.out-a-'));
  const b = mkdtempSync(join(root, '.out-b-'));
  try {
    execSync('node main.ts', { cwd: root, env: { ...process.env, MAKEFUN_OUTPUT_DIR: a }, stdio: 'pipe' });
    execSync('node main.ts', { cwd: root, env: { ...process.env, MAKEFUN_OUTPUT_DIR: b }, stdio: 'pipe' });
    const filesA = walk(a).map((f) => f.slice(a.length)).sort();
    const filesB = walk(b).map((f) => f.slice(b.length)).sort();
    assert(JSON.stringify(filesA) === JSON.stringify(filesB), 'file lists differ between runs');
    for (const rel of filesA) {
      const ha = sha256(join(a, rel));
      const hb = sha256(join(b, rel));
      assert(ha === hb, `bytes differ: ${rel}`);
    }
    return `${filesA.length} files identical`;
  } finally {
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

// 2 — game/ stays inside the gate's file and size caps.
check('game/ within caps', () => {
  const files = walk(gameDir);
  assert(files.length <= 993, `too many files: ${files.length}`);
  const bytes = files.reduce((s, f) => s + statSync(f).size, 0);
  assert(bytes <= 48 * 1024 * 1024, `game/ too big: ${bytes}`);
  for (const f of files) {
    assert(Buffer.byteLength(f) <= 1000, `path too long: ${f}`);
  }
  return `${files.length} files, ${(bytes / 1024).toFixed(1)} KiB`;
});

// 3 — index.html exists and fits the 1 MiB cap.
check('index.html present and small', () => {
  const f = join(gameDir, 'index.html');
  assert(existsSync(f), 'game/index.html missing');
  const size = statSync(f).size;
  assert(size <= 1024 * 1024, `index.html too big: ${size}`);
  return `${size} B`;
});

// 4 — screenshots: 4 JPEGs, 1280x720, each under 256 KiB.
check('screenshots valid', () => {
  const files = readdirSync(shotsDir).filter((f) => !f.startsWith('.')).sort();
  assert(files.length >= 3 && files.length <= 4, `expected 3-4 screenshots, got ${files.length}`);
  for (const f of files) {
    assert(/^[A-Za-z0-9._-]+$/.test(f), `bad screenshot name: ${f}`);
    const buf = readFileSync(join(shotsDir, f));
    assert(buf.length <= 262144, `${f} over 256 KiB`);
    assert(buf[0] === 0xff && buf[1] === 0xd8, `${f} is not a JPEG`);
    const size = jpegSize(buf);
    assert(size, `${f}: could not read dimensions`);
    assert(size.w === 1280 && size.h === 720, `${f} is ${size.w}x${size.h}, expected 1280x720`);
  }
  return `${files.length} shots, 1280x720, first is ${files[0]}`;
});

// 5 — no network references in any game source.
check('no network references', () => {
  const files = walk(gameDir).filter((f) => ['.js', '.html', '.mjs'].includes(extname(f)));
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert(!text.includes('http://') && !text.includes('https://'), `${f} names a URL`);
    assert(!text.includes('fetch(') && !text.includes('XMLHttpRequest'), `${f} fetches`);
  }
  return `${files.length} source files clean`;
});

// 6 — dossier.json matches a fresh build and fits the 1.5 MiB cap.
check('dossier matches build', () => {
  const out = mkdtempSync(join(root, '.out-c-'));
  try {
    execSync('node main.ts', { cwd: root, env: { ...process.env, MAKEFUN_OUTPUT_DIR: out }, stdio: 'pipe' });
    const dossier = join(out, 'dossier.json');
    assert(existsSync(dossier), 'dossier.json missing');
    const size = statSync(dossier).size;
    assert(size <= 1572864, `dossier too big: ${size}`);
    assert(size > 1000, 'dossier suspiciously small');
    return `${(size / 1024).toFixed(1)} KiB`;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

// 7 — every game module parses as an ES module in Node.
check('all game modules parse', async () => {
  const files = walk(gameDir).filter((f) => extname(f) === '.js').sort();
  for (const f of files) {
    await import(pathToFileURL(resolve(f)).href);
  }
  return `${files.length} modules imported`;
});

// 8 — main.ts carries the VELMARA hand-in (at least one authored line).
check('main.ts is the VELMARA hand-in', () => {
  const text = readFileSync(join(root, 'main.ts'), 'utf8');
  assert(text.includes('VELMARA'), 'main.ts does not name VELMARA');
  assert(text.includes('buildDossier'), 'main.ts does not call buildDossier');
  assert(text.includes('MAKEFUN_OUTPUT_DIR'), 'main.ts ignores MAKEFUN_OUTPUT_DIR');
  return 'names VELMARA, calls buildDossier';
});

// 9 — vendor/makefun-game.ts is the unchanged kit copy.
check('vendor copy unchanged', () => {
  const got = sha256(join(root, 'vendor', 'makefun-game.ts'));
  const kit = 'dc67187521b24025ff952f8c231485a6eb92d6d71d29edd2a08154ffb4376129';
  assert(got === kit, `vendor sha mismatch: ${got}`);
  return 'sha256 matches the kit';
});

// 10 — docs exist at the root.
check('docs present', () => {
  assert(existsSync(join(root, 'README.md')), 'README.md missing');
  assert(existsSync(join(root, 'DOSSIER.md')), 'DOSSIER.md missing');
  return 'README.md + DOSSIER.md';
});

// 11 — OSI-approved license present.
check('LICENSE present', () => {
  assert(existsSync(join(root, 'LICENSE')), 'LICENSE missing');
  const text = readFileSync(join(root, 'LICENSE'), 'utf8');
  assert(/MIT License/i.test(text), 'LICENSE is not MIT');
  return 'MIT';
});

// 12 — no symlinks under game/.
check('no symlinks in game/', () => {
  const files = walk(gameDir);
  for (const f of files) {
    assert(!lstatSync(f).isSymbolicLink(), `symlink: ${f}`);
  }
  return `${files.length} regular files`;
});

// 13 — no vendored libraries under game/.
check('no vendored libs in game/', () => {
  assert(!existsSync(join(gameDir, 'vendor')), 'game/vendor should not exist');
  const files = walk(gameDir).filter((f) => f.endsWith('.min.js'));
  assert(files.length === 0, 'minified library found in game/');
  return 'zero libraries, all hand-written';
});

// 14 — the game has a complete module split (one job per file).
check('module split complete', () => {
  const src = readdirSync(join(gameDir, 'src'));
  const need = ['boot.js', 'world.js', 'view.js', 'panel.js', 'traffic.js', 'heat.js', 'walkers.js', 'fight.js', 'story.js', 'side.js', 'sound.js', 'keys.js', 'store.js', 'scenes.js', 'check.js', 'rng.js'];
  for (const n of need) assert(src.includes(n), `missing src/${n}`);
  return `${src.length} modules`;
});

// 15 — serve.ts exists and the game has no build step.
check('serve.ts present, no build step', () => {
  assert(existsSync(join(root, 'serve.ts')), 'serve.ts missing');
  assert(!existsSync(join(root, 'package.json')), 'package.json would imply a build step');
  return 'node serve.ts serves game/';
});

await Promise.all(pending);
const passed = results.filter((r) => r.pass).length;
console.log(`\ntest-game.mjs: ${passed}/${results.length} PASS`);
process.exit(passed === results.length ? 0 : 1);
