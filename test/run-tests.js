'use strict';
/* Developer checks. Needs a Chromium: set CHROMIUM_PATH. Usage: node test/run-tests.js */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const R = require('../render.js');
const ROOT = path.join(__dirname, '..');
const fails = [];
function ok(c, m) { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
  const raw = fs.readFileSync(path.join(ROOT, 'timestamps.txt'), 'utf8');
  for (const [file, W, H] of [['index-infographic.html', 1080, 1920], ['index-podcast.html', 1920, 1080]]) {
    for (const mode of ['plain', 'badge', 'audio', 'both']) {
      const p = await b.newPage({ viewport: { width: W, height: H } });
      const errs = []; p.on('pageerror', (e) => errs.push(e.message));
      await p.goto('file://' + path.join(ROOT, file));
      const opts = { logo: 'assets/logo.png' };
      if (mode === 'badge' || mode === 'both') opts.badge = 'assets/google-play-badge.png';
      const res = await p.evaluate(async ([t, o, audio]) => {
        const total = window.init(t, o); window.fit();
        if (audio) window.setAudio(Array.from({ length: 30 * 60 }, (_, i) => Math.abs(Math.sin(i / 7))), 30);
        let n = 0, bad = 0; for (let f = 0; f <= total * 30; f++) { window.seek(f / 30); n++; if (document.querySelectorAll('#stage *').length < 50) bad++; }
        const sample = [0, 3, 6, 20, 50, 55].map((s) => { window.seek(s); const l = document.getElementById('logo'); return s + ':' + (l.style.transform || '').slice(0, 70); });
        const uses = Array.from(document.querySelectorAll('use')).map((u) => u.getAttribute('href').slice(1)); const miss = uses.filter((id) => !document.getElementById(id));
        return { total, n, bad, sample, miss, nuse: uses.length };
      }, [raw, opts, mode === 'audio' || mode === 'both']);
      ok(errs.length === 0 && res.bad === 0, file + ' ' + mode + ': ' + res.n + ' frames, no exceptions');
      ok(res.miss.length === 0, file + ' ' + mode + ': ' + res.nuse + ' <use> refs all resolve');
      if (mode === 'both') console.log('  logo transforms:', res.sample.join(' | '));
      await p.close();
    }
  }
  await b.close();
  /* emoji scan */
  const re = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u25B6\u25B8\u2605\u2606\u2728\u2713\u2714]/u;
  const files = ['index-infographic.html', 'index-podcast.html', 'common.js', 'render.js', 'package.json', 'README.md', '.github/workflows/render.yml'];
  for (const f of files) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); const bad = Array.from(s).filter((c) => re.test(c) && c !== '\u275D' && c !== '\u275E'); ok(bad.length === 0, 'no emoji in ' + f + (bad.length ? ' found ' + bad.join(',') : '')); }
  for (const f of ['index-infographic.html', 'index-podcast.html', 'common.js']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); ok(!/requestAnimationFrame|setTimeout|setInterval|Date\.now|Math\.random|https?:\/\/(?!www\.w3\.org)/.test(s), 'no forbidden APIs / remote URLs in ' + f); ok(!/animation\s*:|transition\s*:|@keyframes/.test(s), 'no CSS animation in ' + f); }
  /* audio analysis on a sine wave (amplitude ramps up, then silence) */
  const rate = 22050, N = rate * 4, buf = Buffer.alloc(N * 2);
  for (let i = 0; i < N; i++) { const amp = i < rate * 2 ? 0.8 : 0.0; buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / rate) * amp * 32767), i * 2); }
  const env = R.analyzeEnvelope(buf, 30);
  ok(env.length === 120 && env[50] > 0.9 && env[110] < 0.05 && env.every((v) => v >= 0 && v <= 1), 'envelope: sine loud then silent (len ' + env.length + ', loud ' + env[50].toFixed(2) + ', quiet ' + env[110].toFixed(3) + ')');
  console.log(fails.length ? 'FAILED: ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
