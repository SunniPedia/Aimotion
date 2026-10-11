// Frame-by-frame renderer (16:9 podcast-studio video): Playwright (Chromium) -> JPEG frames -> FFmpeg (pipe) -> MP4
//
// Optional files (put them next to this script, same folder as index.html):
//   audio.mp3 (.wav/.m4a/.aac)        background sound; looped + faded to fit the video, and it drives the
//                                      reactive glow / equalizer in the caption panel
//   assets/google-play-badge.png      official Google Play badge shown in the "Play Store" scene
//   assets/fonts/SolaimanLipi-*.ttf   Bengali font (the GitHub workflow downloads it if missing)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const WIDTH = parseInt(process.env.WIDTH || '1920', 10);   // output width  (design is 1920x1080, 16:9)
const FPS = parseInt(process.env.FPS || '30', 10);
const OUT = process.env.OUT || 'out/video.mp4';
const START = parseFloat(process.env.START || '0');          // optional: render only a part
const END = process.env.END ? parseFloat(process.env.END) : null;
const AUDIO_VOLUME = process.env.AUDIO_VOLUME || '1.0';      // e.g. 0.6 for quieter background sound
const DESIGN_W = 1920, DESIGN_H = 1080;
const SCALE = WIDTH / DESIGN_W;
const HEIGHT = Math.round(DESIGN_H * SCALE);

/* Loudness envelope of the audio (0..1 per video frame) so the visuals can react to it */
function analyzeAudio(file, fps) {
  return new Promise(resolve => {
    const SR = 22050;
    const ff = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 's16le', '-'],
      { stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks = [];
    ff.stdout.on('data', d => chunks.push(d));
    ff.on('error', () => resolve(null));
    ff.on('close', code => {
      if (code !== 0) return resolve(null);
      const buf = Buffer.concat(chunks);
      const win = Math.floor(SR / fps);
      const frames = Math.floor(buf.length / 2 / win);
      if (frames < 2) return resolve(null);
      const rms = new Float64Array(frames);
      for (let f = 0; f < frames; f++) {
        let s = 0;
        const off = f * win;
        for (let i = 0; i < win; i++) { const v = buf.readInt16LE((off + i) * 2) / 32768; s += v * v; }
        rms[f] = Math.sqrt(s / win);
      }
      const sorted = Array.from(rms).sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1e-6;
      const env = [];
      let prev = 0;
      for (let f = 0; f < frames; f++) {
        const x = Math.min(1, rms[f] / p95);
        prev = x > prev ? prev + (x - prev) * 0.6 : prev + (x - prev) * 0.18;   // fast attack, slow release
        env.push(+prev.toFixed(4));
      }
      resolve(env);
    });
  });
}

(async () => {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const timestamps = fs.readFileSync('timestamps.txt', 'utf8');

  const audioFile = ['audio.mp3', 'audio.wav', 'audio.m4a', 'audio.aac'].find(f => fs.existsSync(f));
  const badge = ['assets/google-play-badge.png', 'assets/google-play-badge.webp', 'assets/google-play-badge.svg', 'assets/google-play-badge.jpg']
    .find(f => fs.existsSync(f));
  console.log('Audio:', audioFile || 'none (no audio.mp3 found - video will be silent, glow uses a soft default pulse)');
  console.log('Google Play badge:', badge || 'none (generic install button will be used)');
  for (const f of ['assets/fonts/SolaimanLipi-Regular.ttf', 'assets/fonts/SolaimanLipi-Bold.ttf']) {
    console.log('Font', f, fs.existsSync(f) ? 'found' : 'MISSING');
  }

  const browser = await chromium.launch({ args: ['--font-render-hinting=none', '--disable-gpu'] });
  const context = await browser.newContext({
    viewport: { width: DESIGN_W, height: DESIGN_H },
    deviceScaleFactor: SCALE,
  });
  const page = await context.newPage();
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  await page.goto('file://' + path.resolve('index.html'));
  await page.waitForFunction(() => document.getElementById('logoImg').complete);

  const total = await page.evaluate(([ts, b]) => window.init(ts, b ? { badge: b } : {}), [timestamps, badge || null]);

  // make sure fonts and images are really loaded before the first screenshot
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 40px SolaimanLipi'),
      document.fonts.load('700 40px SolaimanLipi'),
      document.fonts.load('700 40px "Noto Serif"'),
      document.fonts.load('700 40px "Noto Naskh Arabic"'),
    ].map(p => p.catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map(i => i.decode().catch(() => {})));
  });
  const fitted = await page.evaluate(() => window.fit());
  console.log('Caption font sizes (px):', fitted.join(' '));
  const fontInfo = await page.evaluate(() => ({
    solaiman: document.fonts.check('700 40px SolaimanLipi'),
    loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family + ' ' + f.weight),
  }));
  console.log('Loaded @font-face fonts:', fontInfo.loaded.join(', ') || 'none');
  if (!fontInfo.loaded.some(f => f.startsWith('SolaimanLipi'))) {
    console.warn('WARNING: SolaimanLipi not loaded - Bengali text will use a fallback font. Put the .ttf files in assets/fonts/.');
  }

  // audio-reactive visuals
  if (audioFile) {
    const env = await analyzeAudio(audioFile, FPS);
    if (env) {
      await page.evaluate(([e, f]) => window.setAudio(e, f), [env, FPS]);
      console.log(`Audio envelope: ${env.length} frames`);
    } else {
      console.warn('Could not analyze audio - using default pulse');
    }
  }

  const endT = END !== null ? Math.min(END, total) : total;
  const duration = endT - START;
  const frames = Math.ceil(duration * FPS);
  console.log(`Rendering ${frames} frames @ ${FPS}fps, ${WIDTH}x${HEIGHT}, ${START}s -> ${endT.toFixed(2)}s`);

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-'];
  if (audioFile) {
    // loop the audio if it is shorter than the video, fade in/out, trim to the video length
    args.push('-stream_loop', '-1', '-ss', String(START), '-i', audioFile);
    const fadeIn = START === 0 ? 'afade=t=in:st=0:d=1.5,' : '';
    const fadeOutSt = Math.max(0, duration - 2).toFixed(2);
    args.push('-map', '0:v', '-map', '1:a',
      '-af', `${fadeIn}afade=t=out:st=${fadeOutSt}:d=2,volume=${AUDIO_VOLUME}`,
      '-c:a', 'aac', '-b:a', '192k');
  }
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-t', duration.toFixed(3), '-movflags', '+faststart', OUT);

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
