const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const clickMine=require('./mine-map-helper.cjs'),output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   const mobile=viewport.width<1000,ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
   await page.goto(base);await press('.diff[data-diff="normal"]');
   await page.evaluate(()=>{G.paused=true;localPlayer().gold=5000;updateUI(true);});
   assert.equal(await page.locator('[data-command]').count(),2);
   await clickMine(page,5,{mobile});assert.match(await page.locator('#mineDialogTitle').textContent(),/6 号矿位/);
   const box=await page.locator('#mineDialog').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height);
   await press('#btnMineAction');assert.equal(await page.evaluate(()=>localPlayer().mines[0].slot),5);
   await press('#btnMineClose');await clickMine(page,5,{mobile});
   await press('#btnMineAction');assert.equal(await page.evaluate(()=>localPlayer().mines[0].level),2);
   if(output)await page.screenshot({path:path.join(output,`mines-${viewport.width}-upgrade.png`)});
   await page.evaluate(()=>{localPlayer().gold=0;updateUI(true);});assert.equal(await page.locator('#btnMineAction').isDisabled(),true);
   assert.match(await page.locator('#mineDialogStatus').textContent(),/还需/);
   await page.evaluate(()=>{localPlayer().gold=5000;updateUI(true);});
   for(let i=0;i<3;i++)await press('#btnMineAction');
   assert.equal(await page.evaluate(()=>localPlayer().mines[0].level),5);assert.match(await page.locator('#btnMineAction').textContent(),/满级/);
   await page.keyboard.press('Escape');await page.locator('#mineDialog').waitFor({state:'hidden'});
   await page.waitForFunction(()=>MineUI.slot===null);
   for(let slot=0;slot<5;slot++){await clickMine(page,slot,{mobile});await press('#btnMineAction');await press('#btnMineClose');}
   assert.equal(await page.evaluate(()=>localPlayer().mines.length),6);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.evaluate(()=>{G.phase='combat';updateUI(true);});await clickMine(page,1,{mobile});
   await page.evaluate(()=>{G.phase='over';updateUI(true);});await page.locator('#mineDialog').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);console.log('Mine map UI passed',viewport);await ctx.close();
  }
  const hc=await browser.newContext(),gc=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true});
  const host=await hc.newPage(),guest=await gc.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#createRoom').click();
  await host.waitForFunction(()=>!!Net.room);const code=await host.evaluate(()=>Net.session.code);
  await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();
  await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);await host.locator('#startOnline').click();
  for(const page of [host,guest])await page.waitForFunction(()=>G?.online);
  await clickMine(guest,4,{mobile:true});
  await guest.route('**/api/action?*',async route=>{await new Promise(r=>setTimeout(r,400));await route.continue();});
  await guest.locator('#btnMineAction').tap();assert.equal(await guest.locator('#btnMineAction').isDisabled(),true);
  await guest.waitForFunction(()=>localPlayer().mines[0]?.slot===4&&!MineUI.pending);
  const slot=await guest.evaluate(()=>Net.session.slot);
  assert.equal(await host.evaluate(slot=>G.players[slot].mines.length,slot),0);
  await guest.locator('#btnMineAction').tap();await guest.waitForFunction(()=>localPlayer().mines[0]?.level===2&&!MineUI.pending);
  assert.equal(await host.evaluate(slot=>G.players[slot].gold,slot),null);
  assert.equal(await host.evaluate(()=>localPlayer().mines.length),0);
  if(output)await guest.screenshot({path:path.join(output,'mines-online-phone.png')});
  console.log('Online touch purchase, pending lock and upgrade synchronization passed');await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
