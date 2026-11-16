import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const runs=[];
for(const [version,port] of [['baseline',4178],['current',4179]]) for(const game of ['shoot','circle','cham']) {
 const context=await browser.newContext({viewport:{width:1280,height:800},permissions:['camera']});
 await context.addInitScript(()=>{
  localStorage.setItem('arcade.intro.seen.v1','true');localStorage.setItem('arcade.player.choice',JSON.stringify({nickname:'Test',anonymousName:'익명1000'}));
  window.__metrics={sent:0,results:0,latencies:[],raf:[],camera:null};
  const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async c=>{const s=await get(c);const {width,height,frameRate,aspectRatio,facingMode}=s.getVideoTracks()[0].getSettings();window.__metrics.camera={width,height,frameRate,aspectRatio,facingMode};return s;};
  const Original=window.Worker;
  window.Worker=class extends Original{
   constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='result'){window.__metrics.results++;if(window.__metrics.latencies.length<5000)window.__metrics.latencies.push([performance.now(),performance.now()-e.data.time]);}});}
   postMessage(m,...args){if(m?.type==='frame')window.__metrics.sent++;return super.postMessage(m,...args);}
  };
  let last=0;const tick=t=>{if(last&&window.__metrics.raf.length<5000)window.__metrics.raf.push([performance.now(),t-last]);last=t;requestAnimationFrame(tick)};requestAnimationFrame(tick);
 });
 const page=await context.newPage();await page.route('**/auth/v1/**',route=>route.abort());await page.route('**/rest/v1/**',route=>route.abort());
 const start=Date.now(); const run={runId:`${version}-${game}-01`,version,game,start:new Date(start).toISOString(),warmupMs:3000,measurementMs:10000};
 try{
  await page.goto(`http://127.0.0.1:${port}/WebcamArcade/play/${game}`);
  await page.getByRole('button',{name:'카메라 연결',exact:true}).first().click();
  await page.waitForFunction(()=>window.__metrics.results>=3,{timeout:45000});
  await page.waitForTimeout(3000);const before=await page.evaluate(()=>({time:performance.now(),sent:window.__metrics.sent,results:window.__metrics.results}));
  await page.waitForTimeout(10000);const after=await page.evaluate(()=>({time:performance.now(),...window.__metrics}));
  Object.assign(run,{status:'ok',startupToThirdResultMs:Date.now()-start-13000,before,after});
 }catch(e){Object.assign(run,{status:'error',error:String(e).slice(0,500)});}
 runs.push(run);console.log(version,game,run.status,run.after?.results-run.before?.results || 0);
 await context.close();
}
await browser.close();await writeFile('docs/optimization/raw/synthetic-desktop.json',JSON.stringify({description:'Exploratory, instrumented, fake-camera no-human input; not real recognition or end-to-end latency. One run each, no overhead calibration.',browser:'Chrome 156, headless',runs},null,2));
