'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const THEME = (process.env.THEME || 'podcast').toLowerCase();
const DESIGN = THEME === 'infographic'
  ? { w: 1080, h: 1920, file: 'index-infographic.html' }
  : { w: 1920, h: 1080, file: 'index-podcast.html' };
const WIDTH = parseInt(process.env.WIDTH, 10) || DESIGN.w;
const SCALE = WIDTH / DESIGN.w;
const FPS = parseInt(process.env.FPS, 10) || 30;
const OUT = process.env.OUT || path.join('out', 'video-' + THEME + '.mp4');
const START = parseFloat(process.env.START || '0') || 0;
const END = process.env.END ? parseFloat(process.env.END) : null;
const VOLUME = process.env.AUDIO_VOLUME !== undefined && process.env.AUDIO_VOLUME !== '' ? parseFloat(process.env.AUDIO_VOLUME) : 1.0;
const ROOT = __dirname;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[\/\\])+/, '');
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

function findFirst(dirs, names) {
  for (const d of dirs) for (const n of names) {
    const f = path.join(ROOT, d, n);
    if (fs.existsSync(f)) return { abs: f, rel: (d ? d + '/' : '') + n };
  }
  return null;
}

function analyzeAudio(file, fps, frames) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '22050', '-f', 's16le', '-']);
    const chunks = [];
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => process.stderr.write(c));
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffmpeg audio decode failed (' + code + ')'));
      const buf = Buffer.concat(chunks);
      const n = Math.floor(buf.length / 2);
      const spf = 22050 / fps;
      const nf = Math.max(1, Math.min(frames, Math.floor(n / spf)));
      const rms = new Array(nf);
      for (let i = 0; i < nf; i++) {
        const a = Math.floor(i * spf), b = Math.min(n, Math.floor((i + 1) * spf));
        let sum = 0;
        for (let k = a; k < b; k++) { const v = buf.readInt16LE(k * 2) / 32768; sum += v * v; }
        rms[i] = b > a ? Math.sqrt(sum / (b - a)) : 0;
      }
      const sorted = rms.slice().sort((x, y) => x - y);
      const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || 1e-6;
      const env = new Array(nf);
      let y = 0;
      for (let i = 0; i < nf; i++) {
        const x = Math.min(1, rms[i] / Math.max(p95, 1e-6));
        y = x > y ? y + (x - y) * 0.6 : y + (x - y) * 0.18;
        env[i] = Math.round(y * 1000) / 1000;
      }
      resolve(env);
    });
  });
}

async function main() {
  console.log('Theme: ' + THEME + ' | design ' + DESIGN.w + 'x' + DESIGN.h + ' | width ' + WIDTH + ' | fps ' + FPS);
  const raw = fs.readFileSync(path.join(ROOT, 'timestamps.txt'), 'utf8');
  const badge = findFirst(['assets'], ['google-play-badge.png', 'google-play-badge.webp', 'google-play-badge.svg', 'google-play-badge.jpg', 'google-play-badge.jpeg']);
  const audio = findFirst(['', 'assets'], ['audio.mp3', 'audio.wav', 'audio.m4a', 'audio.aac']);
  console.log(badge ? 'Store badge: ' + badge.rel : 'Store badge: none (neutral button; get the official badge at https://developer.android.com/distribute/tools/promote/badges)');
  console.log(audio ? 'Audio: ' + audio.rel : 'Audio: none -> silent video');
  for (const f of ['SolaimanLipi-Regular.ttf', 'SolaimanLipi-Bold.ttf']) {
    if (!fs.existsSync(path.join(ROOT, 'assets', 'fonts', f))) console.log('WARNING: assets/fonts/' + f + ' is missing');
  }

  const server = await startServer();
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: DESIGN.w, height: DESIGN.h }, deviceScaleFactor: SCALE });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('PAGE ' + m.type() + ': ' + m.text()); });
  await page.goto(base + DESIGN.file);

  const total = await page.evaluate(([r, o]) => window.init(r, o), [raw, { badge: badge ? badge.rel : null }]);
  const fonts = await page.evaluate(async () => {
    const fams = ['SolaimanLipi', 'Noto Serif', 'Noto Naskh Arabic'];
    for (const f of fams) {
      try { await document.fonts.load('700 40px "' + f + '"', 'আ A ع'); await document.fonts.load('400 40px "' + f + '"', 'আ A ع'); } catch (e) {}
    }
    await document.fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(imgs.map((i) => (i.complete ? Promise.resolve() : new Promise((res) => { i.onload = i.onerror = res; }))));
    const bad = imgs.filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
    return { loaded: Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight), bad };
  });
  console.log('@font-face fonts loaded: ' + (fonts.loaded.join(', ') || 'none'));
  if (!fonts.loaded.some((s) => s.indexOf('SolaimanLipi') >= 0)) console.log('WARNING: SolaimanLipi did not load. Bengali falls back to system Noto Bengali fonts. Upload the TTF files to assets/fonts/.');
  if (fonts.bad.length) console.log('WARNING: images failed to load: ' + fonts.bad.join(', '));
  const sizes = await page.evaluate(() => window.fit());
  console.log('Caption sizes: ' + sizes.join(', '));

  const endT = Math.min(END !== null ? END : total, total);
  const frames = Math.max(1, Math.round((endT - START) * FPS));
  const duration = frames / FPS;
  console.log('Total ' + total.toFixed(2) + ' s | rendering ' + START + ' .. ' + endT.toFixed(2) + ' s = ' + frames + ' frames');

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-vcodec', 'mjpeg', '-i', '-'];
  if (audio) {
    const frameCount = Math.ceil(total * FPS);
    const env = await analyzeAudio(audio.abs, FPS, frameCount);
    await page.evaluate(([e, f]) => window.setAudio(e, f), [env, FPS]);
    console.log('Audio envelope: ' + env.length + ' frames');
    args.push('-stream_loop', '-1', '-ss', String(START), '-i', audio.abs);
  }
  fs.mkdirSync(path.dirname(OUT) || '.', { recursive: true });
  args.push('-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2');
  if (audio) {
    const af = [];
    if (START === 0) af.push('afade=t=in:st=0:d=1.5');
    af.push('afade=t=out:st=' + Math.max(0, duration - 2).toFixed(3) + ':d=2');
    af.push('volume=' + VOLUME);
    args.push('-map', '0:v', '-map', '1:a', '-af', af.join(','), '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), '-t', duration.toFixed(4), OUT);

  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  let ffErr = null;
  const ffDone = new Promise((res) => { ff.on('close', (c) => res(c)); ff.on('error', (e) => { ffErr = e; res(-1); }); });
  ff.stdin.on('error', (e) => { ffErr = e; });
  const write = (b) => new Promise((res) => { if (ffErr || ff.stdin.write(b)) res(); else ff.stdin.once('drain', res); });

  for (let i = 0; i < frames; i++) {
    const t = START + i / FPS;
    await page.evaluate((x) => window.seek(x), t);
    const shot = await page.screenshot({ type: 'jpeg', quality: 95 });
    await write(shot);
    if (ffErr) break;
    if (i % 60 === 0) console.log('frame ' + i + '/' + frames + ' (t=' + t.toFixed(2) + 's)');
  }
  ff.stdin.end();
  const code = await ffDone;
  await browser.close();
  server.close();
  if (code !== 0 || ffErr) throw new Error('ffmpeg failed: code ' + code + (ffErr ? ' ' + ffErr.message : ''));
  console.log('Done: ' + OUT);
}

main().catch((e) => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
