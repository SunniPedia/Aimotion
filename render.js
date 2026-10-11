// Frame-by-frame renderer: Playwright (Chromium) -> JPEG frames -> FFmpeg (pipe) -> MP4
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WIDTH = parseInt(process.env.WIDTH || '1080', 10);   // output width  (design is 1080x1920)
const FPS = parseInt(process.env.FPS || '30', 10);
const OUT = process.env.OUT || 'out/video.mp4';
const START = parseFloat(process.env.START || '0');          // optional: render only a part
const END = process.env.END ? parseFloat(process.env.END) : null;
const DESIGN_W = 1080, DESIGN_H = 1920;
const SCALE = WIDTH / DESIGN_W;
const HEIGHT = Math.round(DESIGN_H * SCALE);

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const timestamps = fs.readFileSync('timestamps.txt', 'utf8');

  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu'] });
  const context = await browser.newContext({
    viewport: { width: DESIGN_W, height: DESIGN_H },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.getElementById('logoImg').complete);

  const total = await page.evaluate(ts => window.init(ts), timestamps);
  const endT = END !== null ? Math.min(END, total) : total;
  const frames = Math.ceil((endT - START) * FPS);
  console.log(`Rendering ${frames} frames @ ${FPS}fps, ${WIDTH}x${HEIGHT}, ${START}s -> ${endT.toFixed(2)}s`);

  // optional voice-over: put audio.mp3 (or .wav/.m4a) in the repo root
  const audioFile = ['audio.mp3', 'audio.wav', 'audio.m4a', 'audio.aac'].find(f => fs.existsSync(f));
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (audioFile) {
    console.log('Audio found:', audioFile);
    args.push('-ss', String(START), '-i', audioFile, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k', '-shortest');
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', OUT);

  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((resolve, reject) => {
    ff.on('close', code => (code === 0 ? resolve() : reject(new Error('ffmpeg exited with ' + code))));
    ff.on('error', reject);
  });
  ff.stdin.on('error', () => {});

  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = START + i / FPS;
    await page.evaluate(tt => window.seek(tt), t);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`frame ${i}/${frames}  (${((i / frames) * 100).toFixed(0)}%)  ${el.toFixed(0)}s elapsed`);
    }
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log('Done ->', OUT, `(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
})().catch(e => { console.error(e); process.exit(1); });
