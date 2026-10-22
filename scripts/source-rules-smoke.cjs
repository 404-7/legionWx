const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   const mobile=viewport.width<1000,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
   await page.goto(base);await press('.diff[data-diff="normal"]');await page.evaluate(()=>{G.paused=true;G.players.forEach(p=>p.ai=null);updateUI(true);});
   if(mobile)await press('#tab-shop');await page.locator('#panel-shop').waitFor({state:'visible'});
   assert.equal(await page.locator('#populationInfo').textContent(),'人口 0 / 15');
   await press('#btnFarmUpgrade');assert.equal(await page.locator('#populationInfo').textContent(),'人口 0 / 23');assert.equal(await page.evaluate(()=>localPlayer().gold),196);
   const result=await page.evaluate(()=>{
    const p=localPlayer();p.gold=10000;buyFighter(p,'ent',0,0);G.wave=30;G.waveDef=waveDefFor(30);endWave();updateUI(true);
    const prep={wave:G.wave,time:G.timer,visible:visionOpen(G)};startCombat();const f=p.fighters[0];f.hp=12;f.cd=7;bonusStep341(60);updateUI(true);draw(performance.now());
    return {prep,batch:G.bonus.batch,timer:G.bonus.timer,hp:f.hp,cd:f.cd,queue:p.spawnList.length,result:G.result};
   });
   assert.deepEqual(result.prep,{wave:31,time:60,visible:true});assert.equal(result.batch,2);assert.equal(result.hp,12);assert.equal(result.cd,7);assert.equal(result.queue,30);assert.equal(result.result,null);assert.ok(Math.abs(result.timer-51.66666666666667)<1e-5);
   assert.match(await page.locator('#stWave').textContent(),/燃烧军团/);assert.match(await page.locator('#waveInfo').textContent(),/存活部队保留/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   if(process.argv[3]){fs.mkdirSync(process.argv[3],{recursive:true});await page.screenshot({path:path.join(process.argv[3],`source-rules-${viewport.width}.png`)});}
   assert.deepEqual(errors,[]);await context.close();console.log('Source farm controls, bonus survival and layout passed',viewport);
  }
  const hc=await browser.newContext(),gc=await browser.newContext({viewport:{width:933,height:430},isMobile:true,hasTouch:true}),host=await hc.newPage(),guest=await gc.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);const code=await host.evaluate(()=>Net.session.code);
  await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);await host.locator('#startOnline').click();
  for(const page of [host,guest])await page.waitForFunction(()=>G?.online);
  await guest.locator('#tab-shop').tap();await guest.locator('#btnFarmUpgrade').tap();await guest.waitForFunction(()=>localPlayer().farmLevel===1);
  assert.equal(await guest.evaluate(()=>localPlayer().gold),196);assert.equal(await guest.locator('#populationInfo').textContent(),'人口 0 / 23');
  const slot=await guest.evaluate(()=>localPlayer().id);assert.equal(await host.evaluate(slot=>G.players[slot].farmLevel,slot),null);
  await guest.reload();await guest.waitForFunction(()=>G?.online&&localPlayer().farmLevel===1);assert.equal(await guest.evaluate(()=>foodCapacity341(localPlayer())),23);
  console.log('Authenticated farm purchase, enemy privacy and reconnect passed');await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
