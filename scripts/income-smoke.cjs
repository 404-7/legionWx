const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390},{width:360,height:640}]){
   const ctx=await browser.newContext({viewport,hasTouch:viewport.width<1000,isMobile:viewport.width<1000}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.diff[data-diff="normal"]').click();
   await page.evaluate(()=>{G.paused=true;G.players.forEach((p,i)=>{p.ai=null;p.income=20+i*13;p.name='测试玩家'+i;});updateUI(true);});
   assert.equal(await page.locator('#incomeBoard .income-player').count(),2);
   assert.equal(await page.locator('#incomeBoard [data-player="1"] b').textContent(),'33');
   await page.evaluate(()=>{G.wave=10;startArenaPrep();updateUI(true);});
   assert.equal(await page.locator('#incomeBoard .income-player').count(),4);
   assert.equal(await page.locator('#incomeBoard [data-player="2"] b').textContent(),'46');
   for(const stage of ['march','fight','result']){
    await page.evaluate(stage=>{G.phase='combat';G.arena.stage=stage;updateUI(true);},stage);
    assert.equal(await page.locator('#incomeBoard [data-player="3"] b').textContent(),'59');
   }
   const boxes=await page.locator('#incomeBoard .income-player').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,scroll:e.scrollWidth,width:e.clientWidth};}));
   for(const b of boxes)assert.ok(b.x>=0&&b.right<=viewport.width&&b.y>=0&&b.bottom<=viewport.height&&b.scroll<=b.width+1);
   if(process.argv[3]){fs.mkdirSync(process.argv[3],{recursive:true});await page.screenshot({path:path.join(process.argv[3],`income-pk-${viewport.width}.png`)});}
   await page.evaluate(()=>{startPrep();updateUI(true);});assert.equal(await page.locator('#incomeBoard .income-player').count(),2);
   assert.deepEqual(errors,[]);await ctx.close();console.log('Income visibility and compact layout passed',viewport);
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
