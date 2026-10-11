
const fs = require('fs');
const pathMod = require('path');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright');

function log(...a){ console.log('[render]', ...a); }
function fail(e){ console.error(e); process.exit(1); }

function parseArgs(){
  const THEME = (process.env.THEME || 'podcast').trim().toLowerCase();
  const WIDTH = parseInt(process.env.WIDTH || (THEME==='infographic'?'1080':'1920'),10);
  const FPS = parseInt(process.env.FPS || '30',10);
  const OUT = process.env.OUT || `out/video-${THEME}.mp4`;
  const START = process.env.START ? parseFloat(process.env.START) : 0;
  const END = process.env.END ? parseFloat(process.env.END) : null;
  const AUDIO_VOLUME = process.env.AUDIO_VOLUME || '1.0';
  return {THEME,WIDTH,FPS,OUT,START,END,AUDIO_VOLUME};
}

function findAudioFile(){
  const exts=['mp3','wav','m4a','aac','ogg','flac'];
  for(const ext of exts){
    const candidates=[`audio.${ext}`, `assets/audio.${ext}`];
    for(const c of candidates){ if(fs.existsSync(c)) return c; }
  }
  if(fs.existsSync('.')){
    for(const f of fs.readdirSync('.')){
      if(/^audio\./i.test(f)) return f;
    }
    if(fs.existsSync('assets')){
      for(const f of fs.readdirSync('assets')){
        if(/^audio\./i.test(f)) return pathMod.join('assets',f);
      }
    }
  }
  return null;
}

function findBadgeFile(){
  const names=['assets/google-play-badge.png','assets/google-play-badge.webp','assets/google-play-badge.svg','assets/google-play-badge.jpg','google-play-badge.png','assets/play-badge.png'];
  for(const n of names) if(fs.existsSync(n)) return n;
  if(fs.existsSync('assets')){
    for(const f of fs.readdirSync('assets')){
      if(/google.*play.*badge/i.test(f) || /play.*badge/i.test(f)) return pathMod.join('assets',f);
    }
  }
  return null;
}

function analyzeAudio(audioPath, fps, duration){
  log('Analyzing audio', audioPath);
  const tmpRaw = '/tmp/audio.raw';
  let res = spawnSync('ffmpeg',['-y','-i',audioPath,'-ac','1','-ar','22050','-f','s16le',tmpRaw],{stdio:'inherit'});
  if(res.status!==0) throw new Error('ffmpeg decode failed');
  const buf = fs.readFileSync(tmpRaw);
  const samplesPerFrame = Math.floor(22050 / fps);
  const totalFrames = Math.ceil(duration * fps);
  const totalSamples = buf.length/2;
  const envelope=[];
  const view = new DataView(buf.buffer, buf.byteOffset, buf.length);
  const rmsPerFrame=[];
  for(let fr=0; fr<totalFrames; fr++){
    let sumSq=0;
    let count=0;
    const startSample = Math.floor((fr * 22050)/fps);
    for(let s=0; s<samplesPerFrame; s++){
      const idx = startSample + s;
      if(idx>=totalSamples) break;
      const val = view.getInt16(idx*2, true)/32768;
      sumSq += val*val;
      count++;
    }
    const rms = count? Math.sqrt(sumSq/count):0;
    rmsPerFrame.push(rms);
  }
  const sorted=[...rmsPerFrame].sort((a,b)=>a-b);
  const p95 = sorted[Math.floor(sorted.length*0.95)] || 0.1;
  const norm = p95>0.0001? p95:0.1;
  let smoothed=0;
  for(let i=0;i<rmsPerFrame.length;i++){
    const target = Math.min(1, rmsPerFrame[i]/norm * 1.1);
    if(target > smoothed){
      smoothed = smoothed + (target - smoothed)*0.6;
    } else {
      smoothed = smoothed + (target - smoothed)*0.18;
    }
    envelope.push(Math.max(0, Math.min(1, smoothed)));
  }
  try{fs.unlinkSync(tmpRaw);}catch{}
  return envelope;
}

async function main(){
  try{
    const {THEME,WIDTH,FPS,OUT,START,END,AUDIO_VOLUME} = parseArgs();
    log(`Theme=${THEME} WIDTH=${WIDTH} FPS=${FPS} OUT=${OUT} START=${START} END=${END||'full'} AUDIO_VOLUME=${AUDIO_VOLUME}`);
    const htmlFile = THEME==='infographic' ? 'index-infographic.html' : 'index-podcast.html';
    if(!fs.existsSync(htmlFile)) throw new Error(`HTML not found: ${htmlFile}`);
    const tsText = fs.readFileSync('timestamps.txt','utf-8');
    const badgePath = findBadgeFile();
    const audioPath = findAudioFile();
    log(`Badge: ${badgePath||'none'} Audio: ${audioPath||'none'}`);

    const designWidth = THEME==='infographic'?1080:1920;
    const designHeight= THEME==='infographic'?1920:1080;
    const deviceScale = WIDTH / designWidth;

    const browser = await chromium.launch({args:['--no-sandbox','--font-render-hinting=none']});
    const context = await browser.newContext({viewport:{width:designWidth,height:designHeight}, deviceScaleFactor: deviceScale});
    const page = await context.newPage();
    page.on('console', m=>console.log('[page]',m.text()));
    page.on('pageerror', e=>console.error('[pageerror]',e));

    const fileUrl = 'file://' + pathMod.resolve(htmlFile);
    await page.goto(fileUrl, {waitUntil:'domcontentloaded'});

    const opts = {};
    if(badgePath) opts.badge = badgePath;

    const totalDuration = await page.evaluate(async (raw, opts)=>{
      if(!window.init) throw new Error('window.init missing');
      const d = window.init(raw, opts||{});
      return d;
    }, tsText, opts);

    let duration = totalDuration;
    if(END!==null) duration = Math.min(duration, END);
    const effStart = START||0;
    const effDuration = duration - effStart;
    if(effDuration<=0) throw new Error('Invalid START/END');

    log(`Total duration ${totalDuration.toFixed(3)}s, rendering ${effDuration.toFixed(3)}s from ${effStart}s`);

    await page.evaluate(async ()=>{
      if(document.fonts && document.fonts.ready){
        try{ await document.fonts.ready; }catch{}
        const families=['SolaimanLipi','Noto Serif','Noto Naskh Arabic','Noto Color Emoji','Noto Serif Bengali','Noto Sans Bengali'];
        for(const fam of families){
          try{ await document.fonts.load(`12px "${fam}"`); }catch{}
        }
      }
    });
    await page.evaluate(async ()=>{
      const imgs=[...document.images];
      await Promise.all(imgs.map(im=> im.complete? Promise.resolve(): new Promise(res=>{im.onload=res; im.onerror=res; setTimeout(res,3000);})));
    });

    const fontReport = await page.evaluate(()=>{
      const out=[];
      try{
        if(document.fonts){
          document.fonts.forEach(f=>{ out.push(`${f.family} ${f.status}`); });
        }
      }catch{}
      return out;
    });
    log('Fonts:', fontReport.join(' | '));
    const mainFontMissing = await page.evaluate(()=>{
      if(!document.fonts) return true;
      let found=false;
      document.fonts.forEach(f=>{ if(/SolaimanLipi/i.test(f.family) && f.status==='loaded') found=true; });
      return !found;
    });
    if(mainFontMissing){
      console.warn('::warning:: SolaimanLipi font not loaded - upload TTF to assets/fonts/');
    }

    await page.evaluate(()=>{ if(window.fit) window.fit(); });

    let envelope=null;
    if(audioPath){
      try{ envelope = analyzeAudio(audioPath, FPS, totalDuration); }catch(e){ console.warn('Audio analysis failed', e.message); }
    }
    if(envelope){
      await page.evaluate((env,fps)=>{ if(window.setAudio) window.setAudio(env,fps); }, envelope, FPS);
    } else {
      await page.evaluate(()=>{ if(window.setAudio) window.setAudio(null,30); });
    }

    const outDir = pathMod.dirname(OUT);
    fs.mkdirSync(outDir,{recursive:true});
    const ffArgs=['-y','-f','image2pipe','-r',String(FPS),'-vcodec','mjpeg','-i','-'];
    if(audioPath){
      ffArgs.push('-stream_loop','-1');
      ffArgs.push('-ss', String(effStart));
      ffArgs.push('-i', audioPath);
      ffArgs.push('-map','0:v','-map','1:a');
      let af=`volume=${AUDIO_VOLUME}`;
      if(effStart===0){
        af = `afade=t=in:st=0:d=1.5,${af},afade=t=out:st=${(effDuration-2).toFixed(3)}:d=2`;
      } else {
        af = `${af},afade=t=out:st=${(effDuration-2).toFixed(3)}:d=2`;
      }
      ffArgs.push('-af', af);
      ffArgs.push('-c:a','aac','-b:a','192k');
    }
    ffArgs.push('-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-movflags','+faststart','-r',String(FPS),'-t',String(effDuration),OUT);

    log('FFmpeg', ffArgs.join(' '));
    const ff = spawn('ffmpeg', ffArgs, {stdio:['pipe','inherit','inherit']});

    const totalFrames = Math.ceil(effDuration*FPS);
    for(let i=0;i<totalFrames;i++){
      const t = effStart + i/FPS;
      await page.evaluate((tt)=>{ if(window.seek) window.seek(tt); }, t);
      const buf = await page.screenshot({type:'jpeg', quality:95});
      const ok = ff.stdin.write(buf);
      if(!ok){ await new Promise(res=>ff.stdin.once('drain', res)); }
      if(i%60===0) log(`Frame ${i}/${totalFrames} t=${t.toFixed(2)}`);
    }
    ff.stdin.end();
    await new Promise((res,rej)=>{
      ff.on('close', code=>{ if(code===0) res(); else rej(new Error('ffmpeg exit '+code)); });
    });
    await browser.close();
    log(`Done: ${OUT}`);
  }catch(e){ console.error(e); process.exit(1); }
}
main();
