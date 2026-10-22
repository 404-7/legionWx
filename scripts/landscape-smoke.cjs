const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:844,height:390},{width:933,height:430},{width:1024,height:430}]){
   const context=await browser.newContext({viewport,hasTouch:true,isMobile:true,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);
   await page.locator('.diff[data-diff="normal"]').tap();await page.locator('#btnMore').tap();await page.locator('[data-delegate="btnPause"]').tap();
   assert.equal(await page.evaluate(()=>CommandUI.mobile),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('#orientationHint').isVisible(),false);
   const bounds=await page.evaluate(()=>({nav:$('commandTabs').getBoundingClientRect().toJSON(),map:$('mapViewport').getBoundingClientRect().toJSON()}));
   assert.ok(bounds.nav.width<100&&bounds.nav.height>=viewport.height-1,'right-side command rail');
   assert.ok(bounds.map.width>bounds.map.height*1.7,'wide battlefield');
   const roadPixels=await page.evaluate(()=>{
    const a=document.createElement('canvas'),b=document.createElement('canvas');a.width=b.width=a.height=b.height=256;
    const ca=a.getContext('2d'),cb=b.getContext('2d'),vertical=[[128,12],[128,244]],branch=[[128,128],[244,128]];
    drawStoneRoads(ca,[vertical,branch]);drawStoneRoads(cb,[vertical]);
    return [[100,155],[110,165],[151,156]].every(([x,y])=>String(ca.getImageData(x,y,1,1).data)===String(cb.getImageData(x,y,1,1).data));
   });assert.equal(roadPixels,true,'T-junction pavement is not covered by an endpoint curb');
   await page.evaluate(()=>{localPlayer().gold=5000;updateUI(true);});
   await page.locator('#tab-shop').tap();await page.waitForFunction(()=>getComputedStyle($('side')).transform==='matrix(1, 0, 0, 1, 0, 0)');
   assert.ok(await page.evaluate(()=>$('side').getBoundingClientRect().right<=$('commandTabs').getBoundingClientRect().left+1));
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,`landscape-${viewport.width}-shop.png`)});}
   await page.locator('[data-uid="infantry"] .uName').tap();await page.locator('#side').waitFor({state:'hidden'});
   const point=await page.evaluate(()=>{const p=localPlayer(),v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+(p.gx+5.5*CFG.CELL)*v.scale,y:r.top+v.ty+(p.gy+7.5*CFG.CELL)*v.scale};});
   await page.touchscreen.tap(point.x,point.y);assert.equal(await page.evaluate(()=>localPlayer().fighters[0]?.uid),'infantry');
   await page.locator('#btnCancelPlacement').tap();await require('./mine-map-helper.cjs')(page,0,{mobile:true});await page.locator('#btnMineAction').tap();
   assert.equal(await page.evaluate(()=>localPlayer().mines.length),1);
   await page.locator('#btnMineClose').tap();
   if(output)await page.screenshot({path:path.join(output,`landscape-${viewport.width}-battle.png`)});
   if(viewport.width===844){
    const before=await page.evaluate(()=>({gold:localPlayer().gold,count:localPlayer().fighters.length,wave:G.wave}));
    await page.setViewportSize({width:390,height:844});await page.locator('#orientationHint').waitFor({state:'visible'});
    await page.locator('#btnDismissRotation').tap();assert.equal(await page.locator('#orientationHint').isVisible(),false);
    await page.setViewportSize(viewport);await page.waitForFunction(()=>$('commandTabs').getBoundingClientRect().width<100);
    assert.deepEqual(await page.evaluate(()=>({gold:localPlayer().gold,count:localPlayer().fighters.length,wave:G.wave})),before,'rotation preserves the game');
   }
   assert.deepEqual(errors,[]);console.log('Landscape and road junction passed',viewport.width+'x'+viewport.height);await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
