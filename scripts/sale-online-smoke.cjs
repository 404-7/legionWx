const assert=require('node:assert/strict');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  const hc=await browser.newContext(),gc=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true}),host=await hc.newPage(),guest=await gc.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#roomRaceMode').selectOption('select');await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);
  const code=await host.evaluate(()=>Net.session.code);await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();
  await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);
  await host.locator('#playerRace').selectOption('nature');await guest.locator('#playerRace').selectOption('nature');
  await host.waitForFunction(()=>Net.room.raceReady);await host.locator('#startOnline').click();await guest.waitForFunction(()=>G?.online);
  await guest.evaluate(async()=>{await api('action',{type:'buy',uid:'ent',col:5,row:7});await api('action',{type:'upgrade',col:5,row:7});});
  await guest.waitForFunction(()=>localPlayer().fighters[0]?.uid==='guardian');
  const slot=await guest.evaluate(()=>Net.session.slot);
  const point=await guest.evaluate(()=>{setMapView('local');const f=localPlayer().fighters[0],v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+f.x*v.scale,y:r.top+v.ty+f.y*v.scale};});
  await guest.touchscreen.tap(point.x,point.y);await guest.locator('#btnSell').tap();
  assert.match(await guest.locator('#sellMessage').textContent(),/115 金的 30% 向下取整，返还 34 金/);
  await guest.locator('#btnConfirmSell').tap();await guest.waitForFunction(()=>localPlayer().fighters.length===0&&localPlayer().gold===219);
  assert.equal(await host.evaluate(slot=>G.players[slot].gold,slot),null);
  assert.equal(await host.evaluate(()=>localPlayer().gold),300);
  console.log('Phone sale dialog shows floor(115 * 30%) = 34; both clients agree on the authoritative refund');
  await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
