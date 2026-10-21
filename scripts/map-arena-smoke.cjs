// New-map and PK workflow verification; accepts Playwright package and preview directory.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:1050},{width:390,height:844},{width:933,height:430}]){
   const mobile=viewport.width<900||viewport.height<=600,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.diff[data-diff="normal"]').click();
   await page.evaluate(()=>{G.paused=true;G.players.forEach(p=>{p.ai=null;p.gold=100000;const ids=['ent','infantry','gateguard','ranger','gnoll_warrior','bone_warrior'];for(let i=0;i<ids.length;i++)buyFighter(p,ids[i],4+i%3,6+Math.floor(i/3)*2);for(let i=0;i<6;i++)buyMine(p);});setMapView('overview');updateUI(true);});
   assert.equal(await page.evaluate(()=>G.players.every(p=>p.mines.length===6&&p.fighters.length===6)),true);
   assert.equal(await page.evaluate(()=>G.kings[1].x<G.kings[0].x&&G.kings[1].y<G.kings[0].y),true);
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,`new-map-${viewport.width}.png`)});}
   await page.evaluate(()=>{G.wave=10;G.waveDef=waveDefFor(10);endWave();updateUI(true);});
   assert.equal(await page.evaluate(()=>G.battleMode),'arena');assert.equal(await page.evaluate(()=>G.timer),30);
   await page.evaluate(()=>{startCombat();updateUI(true);});
   assert.equal(await page.evaluate(()=>MapCamera.mode),'overview');
   await page.evaluate(()=>{for(let i=0;i<1500&&G.arena.stage!=='result';i++){simStep(.1);if([0,1].every(team=>G.players.some(p=>p.team===team&&p.fighters.some(f=>f.arenaReady&&f.hp>0))))break;}simStep(.5);updateUI(true);});
   assert.equal(await page.evaluate(()=>G.arena.stage==='fight'||G.arena.stage==='march'),true);
   if(mobile){await page.locator('#btnMapHome').tap();await page.waitForFunction(()=>MapCamera.mode==='arena');}
   await page.waitForFunction(()=>ROAD_SKIN.gateAmount>.98);
   await page.evaluate(()=>{updateUI(true);draw(performance.now());});
   if(output)await page.screenshot({path:path.join(output,`new-map-pk-${viewport.width}.png`)});
   assert.equal(await page.evaluate(()=>G.result),null);
   await page.evaluate(()=>{for(let i=0;i<2000&&G.battleMode==='arena';i++)simStep(.1);updateUI(true);});
   assert.equal(await page.evaluate(()=>G.wave),11);assert.equal(await page.evaluate(()=>G.battleMode),'defense');
   assert.equal(await page.evaluate(()=>MapCamera.mode),mobile?'local':'overview');
   assert.equal(await page.evaluate(()=>G.players.every(p=>p.fighters.filter(f=>!f.temporary).length===6)),true);
   assert.deepEqual(errors,[]);console.log('Map and PK UI passed',viewport.width+'x'+viewport.height);await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
