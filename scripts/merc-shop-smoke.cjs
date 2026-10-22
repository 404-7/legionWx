const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  if(output)fs.mkdirSync(output,{recursive:true});
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   const mobile=viewport.width<1000,ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
   await page.goto(base);await press('.diff[data-diff="normal"]');await page.evaluate(()=>{G.paused=true;updateUI(true);});
   await press('#tab-attack');assert.equal(await page.locator('[data-merc-id]').count(),24);
   await page.waitForFunction(()=>getComputedStyle($('side')).transform==='none'||getComputedStyle($('side')).transform==='matrix(1, 0, 0, 1, 0, 0)');
   const grid=await page.locator('.merc-grid').first().evaluate(el=>[...el.children].slice(0,2).map(c=>c.getBoundingClientRect().toJSON()));
   assert.ok(Math.abs(grid[0].y-grid[1].y)<1&&grid[1].x>grid[0].x,'cards occupy two columns');
   if(output)await page.screenshot({path:path.join(output,`attack-${viewport.width}-cards.png`)});
   const original=await page.evaluate(()=>localPlayer().gold);
   await press('[data-merc-id="militia"] .merc-info');assert.match(await page.locator('#mercDetailName').textContent(),/民兵/);
   assert.equal(await page.evaluate(()=>localPlayer().gold),original,'viewing details never sends');
   assert.equal(await page.locator('#mercDetailStats>div').count(),8);
   await press('[data-merc-detail-send="0"]');assert.equal(await page.evaluate(()=>localPlayer().gold),original-20);
   assert.equal(await page.evaluate(()=>G.players[2].mercQueue[0]),'militia');await press('#btnMercClose');
   await press('[data-merc-id="demon"] .merc-info');assert.equal(await page.locator('[data-merc-detail-send="0"]').isDisabled(),true);
   assert.match(await page.locator('#mercDetailStatus').textContent(),/15 波解锁/);
   await page.keyboard.press('Escape');await page.locator('#mercDialog').waitFor({state:'hidden'});
   await page.evaluate(()=>{G.wave=15;localPlayer().gold=5000;updateUI(true);});
   await press('[data-merc-id="kraken"] .merc-info');assert.equal(await page.locator('#mercDetailSkills article').count(),3);
   const box=await page.locator('#mercDialog').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=viewport.height);
   if(output)await page.screenshot({path:path.join(output,`attack-${viewport.width}-detail.png`)});
   await page.locator('#mercDetailSkills article').last().scrollIntoViewIfNeeded();
   assert.equal(await page.locator('[data-merc-detail-send="0"]').isVisible(),true,'send actions remain visible while scrolling details');
   await press('[data-merc-detail-send="0"]');assert.equal(await page.evaluate(()=>G.players[2].mercQueue.at(-1)),'kraken');
   await page.evaluate(()=>{localPlayer().gold=0;updateUI(true);});assert.equal(await page.locator('[data-merc-detail-send="0"]').isDisabled(),true);
   await press('#btnMercClose');await press('[data-merc-id="hermit"] .merc-info');assert.match(await page.locator('#mercDetailSkills').textContent(),/治疗光环/);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.deepEqual(errors,[]);console.log('Mercenary cards and detail passed',viewport);await ctx.close();
  }
  const hc=await browser.newContext(),gc=await browser.newContext({viewport:{width:933,height:430},hasTouch:true,isMobile:true});
  const host=await hc.newPage(),guest=await gc.newPage();
  await host.goto(base);await host.locator('#modeOnline').click();await host.locator('#createRoom').click();await host.waitForFunction(()=>!!Net.room);
  const code=await host.evaluate(()=>Net.session.code);await guest.goto(base+'?room='+code);await guest.locator('#joinRoom').tap();
  await host.waitForFunction(()=>Net.room?.members.length===2&&!Net.room.waiting);await host.locator('#startOnline').click();
  for(const page of [host,guest])await page.waitForFunction(()=>G?.online);
  await guest.locator('#tab-attack').tap();await guest.locator('[data-merc-id="hermit"] .merc-info').tap();await guest.locator('[data-merc-detail-send="0"]').tap();
  await host.waitForFunction(()=>localPlayer().mercQueue.includes('hermit'));
  const slot=await guest.evaluate(()=>Net.session.slot);
  await guest.waitForFunction(()=>localPlayer().income===10);assert.equal(await host.evaluate(slot=>G.players[slot].income,slot),null);
  assert.equal(await guest.evaluate(()=>localPlayer().income),10);
  const rejected=await guest.evaluate(()=>api('action',{type:'merc',mid:'demon',target:0}).then(()=>false).catch(()=>true));assert.equal(rejected,true);
  console.log('Online phone dispatch, income synchronization and unlock rejection passed');await hc.close();await gc.close();
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
