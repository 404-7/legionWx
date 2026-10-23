const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   if(process.env.NATIVE_ONLY&&viewport.width!==Number(process.env.NATIVE_ONLY))continue;
   const mobile=viewport.width<1000,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
   await page.goto(base);await press('.diff[data-diff="normal"]');await page.evaluate(()=>{G.paused=true;G.players.forEach(p=>p.ai=null);updateUI(true)});
   assert.equal(await page.evaluate(()=>G.players.length),8);assert.equal(await page.locator('#stWood').textContent(),'97');
   if(mobile)await press('#tab-shop');await press('[data-race="nature"]');await press('#btnChooseBuilder');await page.waitForFunction(()=>localPlayer().race==='nature');
   await press('#btnFarmUpgrade');await page.evaluate(()=>{stepConstruction341(localPlayer(),6);updateUI(true)});assert.equal(await page.locator('#stWood').textContent(),'17');assert.equal(await page.evaluate(()=>localPlayer().gold),276);
   assert.equal(await page.locator('#btnWorker').isDisabled(),false);await press('#btnWorker');assert.match(await page.locator('#townActionHint').textContent(),/战力不足.*需要 350/);assert.equal(await page.evaluate(()=>localPlayer().gold),276);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   // Exercise actual map placement at the currently visible source-map cell.
   await press('.ucard[data-uid="ent"]');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const at=await page.evaluate(()=>{const p=localPlayer(),m=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+(m.tx+(p.gx+8.5*CFG.CELL)*m.scale)*r.width/m.w,y:r.top+(m.ty+(p.gy+13.5*CFG.CELL)*m.scale)*r.height/m.h}});
   if(mobile)await page.touchscreen.tap(at.x,at.y);else await page.mouse.click(at.x,at.y);try{await page.waitForFunction(()=>localPlayer().towers.length===1,{},{timeout:5000});}catch(e){console.log('Placement state',await page.evaluate(at=>({at,target:document.elementFromPoint(at.x,at.y)?.outerHTML.slice(0,250),selected:G.selectedShop,player:{race:localPlayer().race,gold:localPlayer().gold,wood:localPlayer().wood},projection:getMapProjection(),cell:fieldCellAt(localPlayer(),projectCanvasPoint(at.x,at.y).x,projectCanvasPoint(at.x,at.y).y)}),at));throw e;}
   assert.equal(await page.evaluate(()=>localPlayer().gold),256);await page.evaluate(()=>{stepConstruction341(localPlayer(),5);updateUI(true)});await press('#btnCancelPlacement');
   if(mobile)await page.touchscreen.tap(at.x,at.y);else await page.mouse.click(at.x,at.y);await page.locator('#btnSell').waitFor({state:'visible'});await press('#btnSell');
   if(mobile)await press('#btnConfirmSell');await page.waitForFunction(()=>localPlayer().towers.length===0);assert.equal(await page.evaluate(()=>localPlayer().gold),276);
   if(process.argv[3]){const output=path.resolve(process.argv[3]);fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,`native-${viewport.width}.png`)});}
   assert.deepEqual(errors,[]);await context.close();console.log('Native source layout, AP choice, gold/wood farm and source refund passed',viewport);
  }
  if(process.env.NATIVE_ONLY)return;
  const hostContext=await browser.newContext(),guestContext=await browser.newContext({viewport:{width:933,height:430},isMobile:true,hasTouch:true}),host=await hostContext.newPage(),guest=await guestContext.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);const code=await host.evaluate(()=>Net.session.code);
  await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);await host.locator('#startOnline').click();for(const p of [host,guest])await p.waitForFunction(()=>G?.online);
  assert.equal(await guest.evaluate(()=>localPlayer().id),4);assert.equal(await guest.evaluate(()=>G.players.length),8);await guest.locator('#tab-shop').tap();await guest.locator('[data-race="nature"]').tap();await guest.locator('#btnChooseBuilder').tap();await guest.waitForFunction(()=>localPlayer().race==='nature');await guest.locator('#btnFarmUpgrade').tap();await guest.waitForFunction(()=>localPlayer().farmLevel===1);
  assert.equal(await guest.evaluate(()=>localPlayer().wood),17);assert.equal(await host.evaluate(()=>G.players[4].wood),null);await guest.reload();await guest.waitForFunction(()=>G?.online&&localPlayer().farmLevel===1);assert.equal(await guest.evaluate(()=>localPlayer().race),'nature');
  await guest.evaluate(()=>{globalThis.previousSyncStream=Net.stream;Net.sync.seq-=2;});await guest.waitForFunction(()=>Net.stream!==previousSyncStream&&Net.stream.readyState===EventSource.OPEN&&Net.sync&&localPlayer().farmLevel===1);assert.equal(await guest.evaluate(()=>localPlayer().wood),17);
  console.log('Native eight-seat protocol, AP choice, wood payment, privacy, reconnect and automatic delta resynchronization passed');await hostContext.close();await guestContext.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
