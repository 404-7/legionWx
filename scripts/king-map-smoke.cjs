const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs'),clickKing=require('./king-map-helper.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   const mobile=viewport.width<1000,ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
   await page.goto(base);await press('.diff[data-diff="normal"]');await page.evaluate(()=>{G.paused=true;updateUI(true);});
   assert.equal(await page.locator('[data-command]').count(),2);
   await clickKing(page,{mobile,enemy:true});assert.equal(await page.locator('#kingDialog').isVisible(),false);
   await clickKing(page,{mobile});assert.match(await page.locator('#kingDialogTitle').textContent(),/苍岚/);
   for(const stat of ['health','attack','regen'])await press(`[data-king-stat="${stat}"]`);
   assert.deepEqual(await page.evaluate(()=>({...G.kings[0].upgrades})),{health:1,attack:1,regen:1});
   assert.equal(await page.evaluate(()=>localPlayer().gold),60);assert.equal(await page.evaluate(()=>localPlayer().income),15);
   assert.equal(await page.locator('[data-king-stat="health"]').isDisabled(),true);
   const bounds=await page.locator('#kingDialog').boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height);
   if(output)await page.screenshot({path:path.join(output,`king-${viewport.width}-upgrades.png`)});
   await page.evaluate(()=>{for(const wave of [4,13,19,23])growKing341(G.kings[0],wave);updateUI(true);});
   await press('.king-skill-details summary');
   assert.equal(await page.locator('.king-skill.learned').count(),4);
   assert.match(await page.locator('#kingInfo').textContent(),/英雄甲 25/);
   await page.locator('.king-skill:last-child').scrollIntoViewIfNeeded();
   assert.match(await page.locator('#kingSkills').textContent(),/耐久光环/);
   if(output)await page.screenshot({path:path.join(output,`king-${viewport.width}-skills.png`)});
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!KingUI.open);
   await press('#blueKingStatus');assert.equal(await page.locator('#kingDialog').isVisible(),true);
   await page.evaluate(()=>{G.phase='over';updateUI(true);});await page.locator('#kingDialog').waitFor({state:'hidden'});
   assert.deepEqual(errors,[]);console.log('Map king upgrades passed',viewport);await ctx.close();
  }
  const hc=await browser.newContext(),gc=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true}),host=await hc.newPage(),guest=await gc.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);
  const code=await host.evaluate(()=>Net.session.code);await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();
  await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);await host.locator('#startOnline').click();
  for(const page of [host,guest])await page.waitForFunction(()=>G?.online);
  await clickKing(guest,{mobile:true});assert.match(await guest.locator('#kingDialogTitle').textContent(),/赤焰/);
  await guest.route('**/api/action?*',async route=>{await new Promise(r=>setTimeout(r,400));await route.continue();});
  await guest.locator('[data-king-stat="attack"]').tap();assert.equal(await guest.locator('[data-king-stat="health"]').isDisabled(),true);
  await guest.waitForFunction(()=>G.kings[localPlayer().team].upgrades.attack===1&&!KingUI.pending);
  await host.waitForFunction(()=>G.kings[1].upgrades.attack===1);
  assert.equal(await host.evaluate(()=>G.kings[0].upgrades.attack),0);
  assert.equal(await guest.evaluate(()=>localPlayer().gold),220);
  assert.match(await guest.locator('#kingDialogTitle').textContent(),/Lv.1/);
  console.log('Online red king upgrade, pending lock and state synchronization passed');await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
