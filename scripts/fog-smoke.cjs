const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:360,height:640}]){
   const mobile=viewport.width<1000,ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.diff[data-diff="normal"]').click();
   const result=await page.evaluate(()=>{
    G.paused=true;G.players.forEach(p=>{p.ai=null;p.gold=10000;});setMapView('overview');
    globalThis.patch=(x,y,w,h)=>{const v=getMapProjection(),c=$('cv').getContext('2d'),px=Math.round((v.tx+x*v.scale)*v.dpr),py=Math.round((v.ty+y*v.scale)*v.dpr);return [...c.getImageData(px,py,Math.max(1,Math.round(w*v.scale*v.dpr)),Math.max(1,Math.round(h*v.scale*v.dpr))).data].join(',');};
    draw(1000);const hidden=patch(180,200,240,240),road=patch(550,680,100,80);
    const enemy=G.players[2];buyFighter(enemy,'ent',5,7);const f=enemy.fighters[0];
    addPuff(f.x,f.y,'#ff0000',100);addFloater(f.x,f.y,'SECRET','#ff0000');draw(1000);
    const protectedField=hidden===patch(180,200,240,240);
    buyFighter(enemy,'ent',6,7);enemy.fighters[1].x=600;enemy.fighters[1].y=720;draw(1000);
    const publicRoad=road!==patch(550,680,100,80);
    MapCamera.zoom=2;MapCamera.cx=300;MapCamera.cy=350;draw(1000);const zoomBefore=patch(250,290,80,80);
    addPuff(f.x,f.y,'#ffffff',120);draw(1000);const zoomProtected=zoomBefore===patch(250,290,80,80);
    setMapView('overview');updateUI(true);draw(1000);return {protectedField,publicRoad,zoomProtected};
   });
   assert.deepEqual(result,{protectedField:true,publicRoad:true,zoomProtected:true});
   if(output)await page.screenshot({path:path.join(output,`fog-blue-${viewport.width}.png`)});
   assert.deepEqual(errors,[]);console.log('Opaque fog, visible king road and zoom protection passed',viewport);await ctx.close();
  }
  const hc=await browser.newContext({viewport:{width:1560,height:980}}),gc=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true}),host=await hc.newPage(),guest=await gc.newPage(),errors=[];
  for(const page of [host,guest])page.on('pageerror',e=>errors.push(e.message));
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#roomRaceMode').selectOption('select');await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);
  const code=await host.evaluate(()=>Net.session.code);await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();
  await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);
  await host.locator('#playerRace').selectOption('nature');await guest.locator('#playerRace').selectOption('nature');
  await host.waitForFunction(()=>Net.room.raceReady);await host.locator('#startOnline').click();
  await host.waitForFunction(()=>G?.vision?.team===0);await guest.waitForFunction(()=>G?.vision?.team===1);
  await guest.evaluate(async()=>{await api('action',{type:'buy',uid:'ent',col:5,row:7});await api('action',{type:'mineBuy'});await api('action',{type:'king',stat:'attack'});});
  await guest.waitForFunction(()=>localPlayer().fighters.length===1&&localPlayer().mines.length===1&&G.kings[1].upgrades.attack===1);
  await host.waitForFunction(()=>G.kings[1].upgrades.attack===1);
  assert.equal(await host.evaluate(()=>G.players[2].fighters.length),0);assert.equal(await host.evaluate(()=>G.players[2].mines.length),0);assert.equal(await host.evaluate(()=>G.players[2].gold),null);
  assert.equal(await host.evaluate(()=>G.logLines.some(l=>l.txt.includes('建造金矿'))),false);
  for(const page of [host,guest])await page.locator('#btnMapOverview').click();
  if(output){await host.screenshot({path:path.join(output,'fog-online-blue.png')});await guest.screenshot({path:path.join(output,'fog-online-red-phone.png')});}
  await guest.reload();await guest.waitForFunction(()=>G?.vision?.team===1&&localPlayer().fighters.length===1);
  assert.equal(await guest.evaluate(()=>G.players[0].gold),null);assert.deepEqual(errors,[]);
  console.log('Faction-specific SSE hides army, mines and private logs; enemy king stays public; reconnect restores fog');
  await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
