const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  for(const mode of ['select','random']){
   const hostContext=await browser.newContext({viewport:{width:1560,height:980}}),guestContext=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true,deviceScaleFactor:1});
   const host=await hostContext.newPage(),guest=await guestContext.newPage(),errors=[];
   for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
   await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#playerName').fill('房主');await host.locator('#roomRaceMode').selectOption(mode);await host.locator('#createRoom').click();
   await host.waitForFunction(()=>!!Net.room);const code=await host.evaluate(()=>Net.session.code);
   await guest.goto(base+'?room='+code);await guest.locator('#playerName').fill('手机玩家');await guest.locator('#joinRoom').tap();
   for(const page of [host,guest])await page.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);
   assert.equal(await guest.evaluate(()=>Net.room.raceMode),mode);
   if(mode==='select'){
    assert.equal(await host.locator('#startOnline').isDisabled(),true);
    await host.locator('#playerRace').selectOption('nature');await guest.locator('#playerRace').selectOption('mech');
    for(const page of [host,guest])await page.waitForFunction(()=>Net.room.raceReady);
    if(output){fs.mkdirSync(output,{recursive:true});await host.screenshot({path:path.join(output,'race-select-lobby-desktop.png')});await guest.screenshot({path:path.join(output,'race-select-lobby-phone.png')});}
   }else assert.equal(await host.locator('#lobbyRaceChoice').isVisible(),false);
   await host.locator('#startOnline').click();
   for(const page of [host,guest])await page.waitForFunction(()=>G?.online&&!!localPlayer().race);
   if(mode==='select'){assert.equal(await host.evaluate(()=>localPlayer().race),'nature');assert.equal(await guest.evaluate(()=>localPlayer().race),'mech');}
   for(const page of [host,guest]){
    assert.equal(await page.locator('.race-tab').count(),1);
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.ucard')].every(card=>UNITS[card.dataset.uid].race===localPlayer().race)),true);
    const unchanged=await page.evaluate(async()=>{const p=localPlayer(),foreign=Object.values(UNITS).find(d=>d.race!==p.race&&!d.elite&&!d.summonOnly);return api('action',{type:'buy',uid:foreign.id,col:0,row:0,race:foreign.race}).then(()=>false).catch(()=>true);});
    assert.equal(unchanged,true,'server must reject a foreign-race purchase');
    assert.equal(await page.evaluate(async()=>api('race',{race:'beast'}).then(()=>false).catch(()=>true)),true);
   }
   const race=await guest.evaluate(()=>localPlayer().race),uid=await guest.evaluate(()=>Object.values(UNITS).find(d=>d.race===localPlayer().race&&!d.elite&&!d.summonOnly&&d.purchaseCost<=300).id);
   await guest.locator('#tab-shop').tap();await guest.locator(`[data-uid="${uid}"] .uName`).tap();await guest.locator('#side').waitFor({state:'hidden'});
   const point=await guest.evaluate(()=>{const p=localPlayer(),v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+(p.gx+5.5*CFG.CELL)*v.scale,y:r.top+v.ty+(p.gy+7.5*CFG.CELL)*v.scale};});
   await guest.touchscreen.tap(point.x,point.y);await host.waitForFunction(()=>G.players[2].fighters.length===1);
   assert.equal(await host.evaluate(()=>G.players[2].fighters[0].def.race),race);
   await guest.reload();await guest.waitForFunction(()=>G?.online&&!!localPlayer().race);
   assert.equal(await guest.evaluate(()=>localPlayer().race),race);assert.equal(await guest.locator('.race-tab').count(),1);
   if(output){await guest.locator('#tab-shop').tap();await guest.waitForFunction(()=>getComputedStyle($('side')).transform==='matrix(1, 0, 0, 1, 0, 0)');await guest.screenshot({path:path.join(output,`race-${mode}-shop-phone.png`)});}
   assert.deepEqual(errors,[]);console.log('Two-client race mode passed',mode,'with phone placement and reload');
   await hostContext.close();await guestContext.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
