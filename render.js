'use strict';
// Renders the promo video: Playwright (Chromium) screenshots -> FFmpeg (libx264).
// Env: THEME (infographic|podcast, default podcast), WIDTH, FPS (30), OUT, START, END, AUDIO_VOLUME (1.0)
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const THEME = (process.env.THEME || 'podcast').toLowerCase();
const DESIGN = {
  infographic: { w: 1080, h: 1920, file: 'index-infographic.html' },
  podcast: { w: 1920, h: 1080, file: 'index-podcast.html' }
}[THEME];
if (!DESIGN) { console.error('THEME must be infographic or podcast, got: ' + THEME); process.exit(1); }

const WIDTH = parseInt(process.env.WIDTH || String(DESIGN.w), 10);
const SCALE = WIDTH / DESIGN.w;
const OUT_W = Math.round(DESIGN.w * SCALE), OUT_H = Math.round(DESIGN.h * SCALE);
const FPS = parseInt(process.env.FPS || '30', 10);
const OUT = process.env.OUT || path.join('out', 'video-' + THEME + '.mp4');
const AUDIO_VOLUME = process.env.AUDIO_VOLUME || '1.0';

function log() { console.log.apply(console, ['[' + THEME + ']'].concat([].slice.call(arguments))); }

function findAudio() {
  for (const ext of ['mp3', 'wav', 'm4a', 'aac']) {
    const p = path.join(ROOT, 'audio.' + ext);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function findAsset(dir, bases, exts) {
  for (const b of bases) for (const e of exts) {
    const p = path.join(ROOT, dir, b + '.' + e);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
const MIME = { png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg' };

// Mono 22050 Hz decode -> RMS per video frame -> normalise (95th percentile) -> attack/release smoothing
function analyzeAudio(file, fps) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffmpeg audio decode failed (code ' + code + ')'));
      const buf = Buffer.concat(chunks), n = Math.floor(buf.length / 2), per = 22050 / fps;
      const frames = Math.max(1, Math.floor(n / per)), rms = new Array(frames);
      for (let f = 0; f < frames; f++) {
        const a = Math.floor(f * per), b = Math.min(n, Math.floor((f + 1) * per));
        let s = 0;
        for (let i = a; i < b; i++) { const v = buf.readInt16LE(i * 2) / 32768; s += v * v; }
        rms[f] = Math.sqrt(s / Math.max(1, b - a));
      }
      const sorted = rms.slice().sort((x, y) => x - y);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 1e-6;
      let y = 0;
      const env = rms.map((r) => {
        const x = Math.min(1, r / Math.max(p95, 1e-6));
        y = x > y ? y + (x - y) * 0.6 : y + (x - y) * 0.18;
        return y;
      });
      resolve(env);
    });
  });
}

async function main() {
  const rawTs = fs.readFileSync(path.join(ROOT, 'timestamps.txt'), 'utf8');
  const logo = findAsset('assets', ['logo'], ['png', 'webp', 'svg', 'jpg', 'jpeg']);
  const badgeFile = findAsset('assets', ['google-play-badge', 'google-play', 'play-badge'], ['png', 'webp', 'svg', 'jpg', 'jpeg']);
  const audio = findAudio();
  const opts = { theme: THEME };
  if (logo) opts.logo = path.relative(ROOT, logo).split(path.sep).join('/'); else log('WARNING: assets/logo.png not found');
  if (badgeFile) {
    // passed as a data URL so the page can trim the white margin of the official badge (no file:// canvas taint)
    const ext = path.extname(badgeFile).slice(1).toLowerCase();
    opts.badge = 'data:' + (MIME[ext] || 'image/png') + ';base64,' + fs.readFileSync(badgeFile).toString('base64');
    log('Google Play badge found: ' + path.basename(badgeFile));
  } else {
    log('No assets/google-play-badge.png: a neutral gold install button is used. Get the official badge at https://developer.android.com/distribute/tools/promote/badges');
  }

  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-lcd-text'] });
  const ctx = await browser.newContext({ viewport: { width: DESIGN.w, height: DESIGN.h }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => log('PAGE ERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log('page ' + m.type() + ':', m.text()); });

  await page.goto('file://' + path.join(ROOT, DESIGN.file));
  const total = await page.evaluate(([raw, o]) => window.init(raw, o), [rawTs, opts]);

  // fonts
  const fam = await page.evaluate(async () => {
    const wanted = ['SolaimanLipi', 'Noto Serif', 'Noto Naskh Arabic', 'Noto Color Emoji'];
    for (const f of wanted) { try { await document.fonts.load('700 40px "' + f + '"', 'আ Aa ع 😀'); await document.fonts.load('400 40px "' + f + '"', 'আ Aa ع 😀'); } catch (e) { /* ignore */ } }
    await document.fonts.ready;
    const loaded = [];
    document.fonts.forEach((f) => { if (f.status === 'loaded') loaded.push(f.family + ' ' + f.weight); });
    return loaded;
  });
  log('@font-face fonts loaded: ' + (fam.length ? fam.join(', ') : '(none)'));
  if (!fam.some((x) => x.indexOf('SolaimanLipi') >= 0)) {
    log('WARNING: SolaimanLipi did not load (assets/fonts/SolaimanLipi-Regular.ttf / -Bold.ttf missing). Bengali falls back to Noto fonts. Upload the TTF files to assets/fonts/ for the intended look.');
  }
  await page.evaluate(() => (window.__ready || Promise.resolve()));
  await page.evaluate(() => document.fonts.ready);
  const sizes = await page.evaluate(() => window.fit());
  log('caption sizes: ' + sizes.map((s) => s.scene + ':' + s.font + 'px' + (s.overflow ? '(OVERFLOW)' : '')).join(' '));

  // audio
  let env = null;
  if (audio) {
    log('Audio: ' + path.basename(audio) + ' (analysing loudness)');
    env = await analyzeAudio(audio, FPS);
    await page.evaluate(([e, f]) => window.setAudio(e, f), [env, FPS]);
  } else {
    log('No audio.mp3 found: rendering a silent video.');
  }

  const START = parseFloat(process.env.START || '0');
  const END = Math.min(parseFloat(process.env.END || String(total)), total);
  const dur = END - START;
  if (!(dur > 0)) throw new Error('END must be greater than START');
  const frames = Math.round(dur * FPS);
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });

  const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0'];
  if (audio) args.push('-stream_loop', '-1', '-ss', String(START), '-i', audio);
  args.push('-map', '0:v');
  if (audio) {
    args.push('-map', '1:a');
    const fades = (START === 0 ? 'afade=t=in:st=0:d=1.5,' : '') + 'afade=t=out:st=' + Math.max(0, dur - 2).toFixed(3) + ':d=2,volume=' + AUDIO_VOLUME;
    args.push('-af', fades, '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), '-t', dur.toFixed(3), OUT);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const ffDone = new Promise((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with code ' + code))));
  });
  ff.stdin.on('error', () => { /* reported through the close handler */ });

  log('Rendering ' + frames + ' frames (' + OUT_W + 'x' + OUT_H + ' @ ' + FPS + ' fps, ' + dur.toFixed(2) + ' s) -> ' + OUT);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = START + i / FPS;
    await page.evaluate((tt) => window.seek(tt), t);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 60 === 0) log('frame ' + i + '/' + frames + ' (t=' + t.toFixed(2) + ' s, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s elapsed)');
  }
  ff.stdin.end();
  await ffDone;
  await browser.close();
  log('Done: ' + OUT + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
}

main().catch((e) => { console.error('RENDER FAILED:', e && e.stack ? e.stack : e); process.exit(1); });
