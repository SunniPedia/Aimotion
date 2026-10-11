'use strict';
/* Renders index-<theme>.html frame by frame with Playwright and pipes JPEG frames to FFmpeg. */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { once } = require('events');

const DESIGN = {
  infographic: { w: 1080, h: 1920, file: 'index-infographic.html' },
  podcast: { w: 1920, h: 1080, file: 'index-podcast.html' }
};
const ROOT = __dirname;

/* Audio: mono 22050 Hz s16le, RMS per video frame, normalise by 95th percentile, attack 0.6 / release 0.18. */
function analyzeEnvelope(pcm, fps, rate) {
  rate = rate || 22050;
  const n = Math.floor(pcm.length / 2), per = rate / fps, frames = Math.max(1, Math.floor(n / per));
  const raw = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    const a = Math.floor(f * per), b = Math.min(n, Math.floor((f + 1) * per));
    let s = 0;
    for (let i = a; i < b; i++) { const v = pcm.readInt16LE(i * 2) / 32768; s += v * v; }
    raw[f] = b > a ? Math.sqrt(s / (b - a)) : 0;
  }
  const sorted = Array.from(raw).sort((x, y) => x - y);
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 1e-6;
  const env = new Array(frames);
  let y = 0;
  for (let f = 0; f < frames; f++) {
    const x = Math.min(1, raw[f] / (p95 || 1e-6));
    y += (x - y) * (x > y ? 0.6 : 0.18);
    env[f] = Math.max(0, Math.min(1, y));
  }
  return env;
}

function decodeAudio(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error('ffmpeg audio decode failed: ' + String(r.stderr));
  return r.stdout;
}

function findAsset(dir, base, exts) {
  for (const e of exts) { const p = path.join(dir, base + '.' + e); if (fs.existsSync(p)) return p; }
  return null;
}

/* Finds the real artwork area of the badge file (ignores white margins) with ffmpeg cropdetect. */
function detectCrop(file) {
  try {
    const pr = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,pix_fmt', '-of', 'json', file]);
    const s = JSON.parse(String(pr.stdout)).streams[0];
    if (/(rgba|bgra|argb|abgr|yuva|gbrap|ya8|pal8)/.test(s.pix_fmt)) return null;
    const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'negate,cropdetect=limit=24:round=2:skip=0:reset=0', '-frames:v', '1', '-f', 'null', '-']);
    const m = String(r.stderr).match(/crop=(\d+):(\d+):(\d+):(\d+)/g);
    if (!m) return null;
    const q = m[m.length - 1].match(/crop=(\d+):(\d+):(\d+):(\d+)/);
    const c = { w: +q[1], h: +q[2], x: +q[3], y: +q[4], iw: s.width, ih: s.height };
    if (c.w < 20 || c.h < 20 || (c.w >= c.iw - 4 && c.h >= c.ih - 4)) return null;
    return c;
  } catch (e) { return null; }
}

async function main() {
  const THEME = process.env.THEME || 'podcast';
  const D = DESIGN[THEME];
  if (!D) throw new Error('THEME must be infographic or podcast, got ' + THEME);
  const WIDTH = parseInt(process.env.WIDTH || String(D.w), 10);
  const FPS = parseInt(process.env.FPS || '30', 10);
  const OUT = process.env.OUT || path.join('out', 'video-' + THEME + '.mp4');
  const VOL = parseFloat(process.env.AUDIO_VOLUME || '1.0');
  const dsf = WIDTH / D.w, outW = Math.round(D.w * dsf), outH = Math.round(D.h * dsf);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const raw = fs.readFileSync(path.join(ROOT, 'timestamps.txt'), 'utf8');
  const logoFile = findAsset(path.join(ROOT, 'assets'), 'logo', ['png', 'jpg', 'jpeg', 'webp', 'svg']);
  const badgeFile = findAsset(path.join(ROOT, 'assets'), 'google-play-badge', ['png', 'webp', 'svg', 'jpg', 'jpeg']);
  const audioFile = ['mp3', 'wav', 'm4a', 'aac'].map((e) => path.join(ROOT, 'audio.' + e)).find((p) => fs.existsSync(p));
  const opts = { logo: logoFile ? 'assets/' + path.basename(logoFile) : 'assets/logo.png' };
  if (badgeFile) { opts.badge = 'assets/' + path.basename(badgeFile); const c = detectCrop(badgeFile); if (c) opts.badgeCrop = c; }
  console.log('Theme:', THEME, '| output', outW + 'x' + outH, '@', FPS, 'fps | logo:', opts.logo, '| badge:', opts.badge || 'none (neutral button will be used)', opts.badgeCrop ? '(crop ' + JSON.stringify(opts.badgeCrop) + ')' : '');

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--font-render-hinting=none', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: D.w, height: D.h }, deviceScaleFactor: dsf });
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('PAGE CONSOLE ERROR:', m.text()); });
  page.on('requestfailed', (r) => console.log('REQUEST FAILED:', r.url()));
  await page.goto('file://' + path.join(ROOT, D.file));

  const total = await page.evaluate(([txt, o]) => window.init(txt, o), [raw, opts]);
  await page.evaluate(async () => {
    const fams = ['SolaimanLipi', 'Noto Serif', 'Noto Naskh Arabic', 'Noto Serif Bengali'];
    for (const f of fams) { for (const w of ['400', '700']) { try { await document.fonts.load(w + ' 40px "' + f + '"', 'আ A ع'); } catch (e) { /* ignore */ } } }
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((i) => (i.complete ? 1 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  const fonts = await page.evaluate(() => Array.from(document.fonts).map((f) => f.family.replace(/"/g, '') + ' ' + f.weight + ' ' + f.status));
  console.log('@font-face fonts:', fonts.join(' | '));
  if (!fonts.some((f) => /SolaimanLipi/.test(f) && /loaded/.test(f))) console.log('WARNING: main font SolaimanLipi is NOT loaded. Upload assets/fonts/SolaimanLipi-Regular.ttf and -Bold.ttf. Falling back to Noto Serif Bengali.');
  await page.evaluate(() => { if (window.__logoMeasure) window.__logoMeasure(); });
  const fit = await page.evaluate(() => window.fit());
  console.log('Caption sizes:', JSON.stringify(fit.caption), '| visual scale:', JSON.stringify(fit.visual));

  const START = Math.max(0, parseFloat(process.env.START || '0')), END = Math.min(total, parseFloat(process.env.END || String(total)));
  const dur = END - START, frames = Math.round(dur * FPS);
  console.log('Duration', total.toFixed(2), 's | rendering', START, '->', END, '=', frames, 'frames');

  if (audioFile) {
    const env = analyzeEnvelope(decodeAudio(audioFile), FPS);
    await page.evaluate(([e, f]) => window.setAudio(e, f), [env, FPS]);
    console.log('Audio:', path.basename(audioFile), '| envelope frames:', env.length);
  } else console.log('No audio file found (audio.mp3): rendering a silent video.');

  const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (audioFile) args.push('-stream_loop', '-1', '-ss', String(START), '-i', audioFile);
  args.push('-map', '0:v');
  if (audioFile) {
    const af = [];
    if (START === 0) af.push('afade=t=in:st=0:d=1.5');
    af.push('afade=t=out:st=' + Math.max(0, dur - 2).toFixed(3) + ':d=2', 'volume=' + VOL);
    args.push('-map', '1:a', '-af', af.join(','), '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), '-t', dur.toFixed(3), OUT);
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited with code ' + c)))); ff.on('error', rej); });
  ff.stdin.on('error', () => { /* reported by close */ });

  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = START + i / FPS;
    await page.evaluate((tt) => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    if (i % 60 === 0) console.log('frame', i, '/', frames, '(' + t.toFixed(2) + ' s)', ((Date.now() - t0) / 1000).toFixed(0) + 's elapsed');
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('Done:', OUT);
}

module.exports = { analyzeEnvelope, detectCrop, findAsset };
if (require.main === module) main().catch((e) => { console.error('ERROR:', e); process.exit(1); });
