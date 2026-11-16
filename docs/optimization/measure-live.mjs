import {chromium} from 'playwright';
import {writeFile, mkdir} from 'node:fs/promises';
const [version,game,secondsArg='30'] = process.argv.slice(2);
const seconds = Number(secondsArg), ports={baseline:4178,current:4179}, games=['shoot','circle','cham','rps','dodge'];
if (!ports[version] || !games.includes(game) || (version==='baseline' && !['shoot','circle','cham'].includes(game)) || !Number.isFinite(seconds) || seconds<5 || seconds>120) throw Error('Usage: node docs/optimization/measure-live.mjs baseline|current shoot|circle|cham|rps|dodge [5..120 seconds]');
const browser=await chromium.launch({headless:false,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1280,height:800}});
await context.route('**/auth/v1/**',r=>r.abort());await context.route('**/rest/v1/**',r=>r.abort());
await context.addInitScript(()=>{
 localStorage.setItem('arcade.intro.seen.v1','true');localStorage.setItem('arcade.player.choice',JSON.stringify({nickname:'Test',anonymousName:'익명1000'}));
 window.__arcadeMeasure={started:null,sent:0,results:0,latencies:[],raf:[],camera:null};
 const metrics=window.__arcadeMeasure;
 window.addEventListener('keydown',e=>{if(e.code==='F8'&&metrics.started===null){e.preventDefault();metrics.started=performance.now();metrics.before={sent:metrics.sent,results:metrics.results};}});
 const get=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async c=>{const s=await get(c);const {width,height,frameRate,aspectRatio,facingMode}=s.getVideoTracks()[0].getSettings();metrics.camera={width,height,frameRate,aspectRatio,facingMode};return s;};
 const Original=window.Worker;
 window.Worker=class extends Original{
  constructor(...args){super(...args);this.addEventListener('message',e=>{if(e.data.type==='result'){metrics.results++;if(metrics.started!==null&&metrics.latencies.length<12000)metrics.latencies.push([performance.now(),performance.now()-e.data.time]);}});}
  postMessage(m,...args){if(m?.type==='frame')metrics.sent++;return super.postMessage(m,...args);}
 };
 let last=0;const tick=t=>{if(last&&metrics.started!==null&&metrics.raf.length<12000)metrics.raf.push([performance.now(),t-last]);last=t;requestAnimationFrame(tick)};requestAnimationFrame(tick);
});
const page=await context.newPage();
try{
 await page.goto(`http://127.0.0.1:${ports[version]}/WebcamArcade/play/${game}`);
 console.log('카메라 연결 및 브라우저 권한을 직접 허용하고, 게임을 시작한 뒤 F8을 눌러 측정을 시작하세요.');
 await page.waitForFunction(()=>window.__arcadeMeasure.started!==null,null,{timeout:600000});
 console.log(`${seconds}초 측정 중입니다. 평소처럼 플레이하세요. 영상과 랜드마크는 저장하지 않습니다.`);
 await page.waitForTimeout(seconds*1000);
 const data=await page.evaluate(()=>({finished:performance.now(),...window.__arcadeMeasure}));
 await mkdir('artifacts/optimization-live',{recursive:true});
 const file=`artifacts/optimization-live/${version}-${game}-${Date.now()}.json`;
 await writeFile(file,JSON.stringify({version,game,seconds,browser:browser.version(),capturedAt:new Date().toISOString(),data},null,2));
 console.log(`완료: ${file}`);
} finally {await context.close();await browser.close();}
