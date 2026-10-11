const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = __dirname;
const theme = (process.env.THEME || 'podcast').toLowerCase();
if (!['infographic', 'podcast'].includes(theme)) throw new Error(`Unknown THEME: ${theme}`);
const design = theme === 'infographic' ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
const width = Math.max(1, Number(process.env.WIDTH || design.width));
const fps = Math.max(1, Number(process.env.FPS || 30));
const out = process.env.OUT || `out/video-${theme}.mp4`;
const start = Math.max(0, Number(process.env.START || 0));
const audioVolume = Number(process.env.AUDIO_VOLUME || 1);
const timestamps = fs.readFileSync(path.join(ROOT, 'timestamps.txt'), 'utf8');
const audioFile = ['audio.mp3','audio.wav','audio.m4a','audio.aac'].map(x=>path.join(ROOT,x)).find(fs.existsSync);
const hasBadge = ['png','webp','svg','jpg','jpeg'].map(x=>path.join(ROOT,'assets',`google-play-badge.${x}`)).find(fs.existsSync);

function runCapture(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore','pipe','pipe'] });
    const chunks=[]; let err='';
    p.stdout.on('data',d=>chunks.push(d)); p.stderr.on('data',d=>err+=d);
    p.on('error',reject); p.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error(`${cmd} failed: ${err}`)));
  });
}
async function audioEnvelope(duration) {
  if (!audioFile) return null;
  const raw = await runCapture('ffmpeg',['-v','error','-i',audioFile,'-ac','1','-ar','22050','-f','s16le','-acodec','pcm_s16le','pipe:1']);
  const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length/2));
  const samplesPerFrame = Math.max(1,Math.floor(22050/fps)), values=[];
  for(let i=0;i<samples.length;i+=samplesPerFrame){
    let sum=0,n=Math.min(samplesPerFrame,samples.length-i);
    for(let j=0;j<n;j++){const x=samples[i+j]/32768;sum+=x*x}
    values.push(Math.sqrt(sum/Math.max(1,n)));
  }
  const sorted=[...values].sort((a,b)=>a-b), p95=sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]||1;
  let prev=0;
  return values.map(v=>{const target=Math.min(1,v/p95),coef=target>prev?.6:.18;prev=prev+(target-prev)*coef;return prev});
}
function waitDrain(stream){return new Promise((resolve,reject)=>{stream.once('drain',resolve);stream.once('error',reject)})}
async function main(){
  fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext({viewport:{width:design.width,height:design.height},deviceScaleFactor:width/design.width});
    const page=await context.newPage();
    page.on('pageerror',e=>console.error('PAGE ERROR:',e.message));
    page.on('console',m=>{if(m.type()==='error')console.error('PAGE CONSOLE:',m.text())});
    await page.goto('file://'+path.join(ROOT,`index-${theme}.html`),{waitUntil:'load'});
    const fontLoadResults = await page.evaluate(async()=>{
      const specs = [
        ['SolaimanLipi regular', '400 32px SolaimanLipi'],
        ['SolaimanLipi bold', '700 32px SolaimanLipi'],
        ['Noto Serif', '32px "Noto Serif"'],
        ['Noto Naskh Arabic', '32px "Noto Naskh Arabic"'],
        ['Noto Color Emoji', '32px "Noto Color Emoji"']
      ];
      const results = await Promise.all(specs.map(async ([name, spec]) => {
        try { await document.fonts.load(spec); return {name, ok:true}; }
        catch (e) { return {name, ok:false, error:String(e)}; }
      }));
      try { await document.fonts.ready; } catch (e) { /* font failures are reported below */ }
      return results;
    });
    for (const result of fontLoadResults) if (!result.ok) console.warn(`WARNING: Font load failed for ${result.name}: ${result.error}`);
    const fontStatus=await page.evaluate(()=>({regular:document.fonts.check('32px SolaimanLipi'),bold:document.fonts.check('700 32px SolaimanLipi'),families:[...document.fonts].map(f=>`${f.family}:${f.status}`)}));
    console.log('Fonts:',fontStatus.families.join(', ')||'(no @font-face entries)');
    if(!fontStatus.regular)console.warn('WARNING: SolaimanLipi main font missing; Bengali rendering may use system fallback.');
    await page.evaluate(async({raw,badge,audio,fps})=>{window.__duration=window.init(raw,{badge});window.setAudio(audio,fps);window.fit()}, {raw:timestamps,badge:!!hasBadge,audio:null,fps});
    const duration=await page.evaluate(()=>window.__duration);
    const endEnv=process.env.END==null?duration:Math.min(duration,Number(process.env.END));
    const renderDuration=Math.max(0,endEnv-start);
    if(audioFile){const env=await audioEnvelope(duration);await page.evaluate(({env,fps})=>window.setAudio(env,fps),{env,fps})}
    else console.log('No audio file found: rendering silent video.');
    await page.evaluate(()=>window.fit());
    const ffArgs=['-y','-f','image2pipe','-vcodec','mjpeg','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-crf','18','-preset','medium','-pix_fmt','yuv420p','-r',String(fps),'-t',String(renderDuration),'-movflags','+faststart',out];
    const ff=spawn('ffmpeg',ffArgs,{stdio:['pipe','ignore','pipe']});let fferr='';ff.stderr.on('data',d=>fferr+=d);
    const total=Math.ceil(renderDuration*fps);
    for(let frame=0;frame<total;frame++){
      const t=start+frame/fps;
      await page.evaluate(t=>window.seek(t),t);
      const shot=await page.screenshot({type:'jpeg',quality:95});
      if(!ff.stdin.write(shot))await waitDrain(ff.stdin);
      if(frame%60===0)console.log(`Rendered ${frame}/${total} frames (${(frame/fps).toFixed(1)}s)`);
    }
    ff.stdin.end();
    const code=await new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',resolve)});
    if(code!==0)throw new Error(`FFmpeg video encode failed (${code}): ${fferr}`);
    if(audioFile && start===0){
      const temp=out+'.silent.mp4';fs.renameSync(out,temp);
      const fadeOut=Math.max(0,renderDuration-2);
      const args=['-y','-stream_loop','-1','-ss',String(start),'-i',audioFile,'-i',temp,'-map','1:v:0','-map','0:a:0','-af',`afade=t=in:st=0:d=1.5,afade=t=out:st=${fadeOut}:d=2,volume=${audioVolume}`,'-c:v','copy','-c:a','aac','-b:a','192k','-t',String(renderDuration),'-movflags','+faststart',out];
      await new Promise((resolve,reject)=>{const p=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe']});let e='';p.stderr.on('data',d=>e+=d);p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(`FFmpeg audio mux failed: ${e}`)))});
      fs.unlinkSync(temp);
    } else if(audioFile && start>0) {
      console.warn('WARNING: audio mux is skipped for partial renders with START > 0; partial video is silent.');
    }
    console.log(`Done: ${out} (${renderDuration.toFixed(2)}s, ${fps} fps, ${width} px output viewport)`);
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e.stack||e);process.exit(1)});
