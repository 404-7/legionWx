const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:980},{width:390,height:844},{width:360,height:640},{width:844,height:390}]){
   const mobile=viewport.width<=900,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(9000);
   const press=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
   await page.goto('http://127.0.0.1:'+server.address().port);
   await page.locator('.race-tab').first().waitFor({state:'attached'});
   await press('.diff[data-diff="normal"]');
   if(mobile){await press('#btnMore');await press('[data-delegate="btnPause"]');}
   else await press('#btnPause');
   assert.equal(await page.evaluate(()=>G.paused),true);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'horizontal overflow');
   assert.equal(await page.evaluate(()=>CommandUI.mobile),mobile);
   if(mobile){assert.equal(await page.locator('#side').isVisible(),false);if(viewport.width<viewport.height)assert.ok(await page.evaluate(()=>getMapProjection().scale*CFG.CELL)>=44,'touch-sized build cells');}
   await page.evaluate(()=>{localPlayer().gold=5000;updateUI(true);});
   if(mobile)await press('#tab-shop');
   await page.locator('#panel-shop').waitFor({state:'visible'});
   for(const id of ['attack'])assert.equal(await page.locator('#panel-'+id).isVisible(),false);
   await press('[data-uid="infantry"] .uName');
   if(mobile)assert.equal(await page.evaluate(()=>CommandUI.open),false,'selecting a unit collapses drawer');
   assert.equal(await page.locator('#placementBar').isVisible(),true);
   if(mobile){
    await press('#btnMapField');
    await page.waitForFunction(()=>MapCamera.mode==='field');
    assert.equal(await page.evaluate(()=>{const p=localPlayer(),v=getMapProjection(),r=$('cv').getBoundingClientRect();return [0,CFG.COLS-1].every(col=>[0,CFG.ROWS-1].every(row=>document.elementFromPoint(r.left+v.tx+(p.gx+(col+.5)*CFG.CELL)*v.scale,r.top+v.ty+(p.gy+(row+.5)*CFG.CELL)*v.scale)===$('cv')));}),true,'full-field view exposes every grid corner');
    await press('#btnMapHome');
   }
   const cellPoint=()=>page.evaluate(()=>{const p=localPlayer(),v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+(p.gx+5.5*CFG.CELL)*v.scale,y:r.top+v.ty+(p.gy+7.5*CFG.CELL)*v.scale};});
   let point=await cellPoint();
   if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   assert.equal(await page.evaluate(()=>localPlayer().fighters[0]?.uid),'infantry','transformed canvas placement');
   assert.deepEqual(await page.evaluate(()=>({col:localPlayer().fighters[0].col,row:localPlayer().fighters[0].row})),{col:5,row:7});
   await press('#btnCancelPlacement');
   await page.waitForFunction(()=>G.selectedShop===null);
   point=await cellPoint();if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   await page.locator('#panel-inspect').waitFor({state:'visible'});
   await press('[data-upgrade-uid="zeus"]');
   assert.equal(await page.evaluate(()=>localPlayer().fighters[0].uid),'zeus');
   if(mobile){await press('#btnSell');assert.equal(await page.locator('#sellDialog').isVisible(),true);await press('#btnKeepUnit');assert.equal(await page.evaluate(()=>localPlayer().fighters.length),1);}
   await require('./mine-map-helper.cjs')(page,0,{mobile});
   await press('#btnMineAction');await press('#btnMineAction');
   assert.equal(await page.evaluate(()=>localPlayer().mines[0].level),2);
   await press('#btnMineClose');
   await require('./king-map-helper.cjs')(page,{mobile});await press('[data-king-stat="regen"]');
   assert.equal(await page.evaluate(()=>G.kings[localPlayer().team].upgrades.regen),1);
   await press('#btnKingClose');
   await press('#tab-attack');await press('[data-merc-id="militia"] [data-merc-send="0"]');
   assert.equal(await page.evaluate(()=>G.players.filter(p=>p.team!==localPlayer().team).reduce((n,p)=>n+p.mercQueue.length,0)),1);
   if(mobile){
    await press('#btnPanelClose');await press('#btnMapOverview');assert.equal(await page.evaluate(()=>MapCamera.mode),'overview');await press('#btnMapHome');
    const box=await page.locator('#cv').boundingBox();
    const cdp=await context.newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
    const touches=(delta)=>[{x:x-delta,y,id:1},{x:x+delta,y,id:2}];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches(35)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touches(58)});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.ok(await page.evaluate(()=>MapCamera.zoom)>1.2,'pinch zoom');
    await press('#btnMapHome');
    if(viewport.width<viewport.height){
     await press('#tab-shop');await press('[data-uid="infantry"] .uName');
     const count=await page.evaluate(()=>localPlayer().fighters.length);
     await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+45,y:y+35,id:1}]});
     await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
     assert.equal(await page.evaluate(()=>localPlayer().fighters.length),count,'dragging must not buy units');
     await press('#btnCancelPlacement');await page.waitForFunction(()=>G.selectedShop===null);await press('#btnMapHome');
    }
   }
   if(output&&viewport.width!==844){
    fs.mkdirSync(output,{recursive:true});
    await page.screenshot({path:path.join(output,`layout-${viewport.width}-battle.png`)});
    await require('./mine-map-helper.cjs')(page,0,{mobile});await page.screenshot({path:path.join(output,`layout-${viewport.width}-mine.png`)});await press('#btnMineClose');
    await press('#tab-shop');if(mobile)await page.waitForFunction(()=>getComputedStyle($('side')).transform==='matrix(1, 0, 0, 1, 0, 0)');await page.evaluate(()=>$('commandBody').scrollTop=0);await page.screenshot({path:path.join(output,`layout-${viewport.width}-shop.png`)});
   }
   if(mobile){
    await page.evaluate(()=>{G.selectedFighter=localPlayer().fighters[0];updateUI(true);});
    await press('#btnSell');await press('#btnConfirmSell');
    assert.equal(await page.evaluate(()=>localPlayer().fighters.length),0,'confirmed sale removes the unit');
    assert.equal(await page.locator('#sellDialog').isVisible(),false);
   }
   assert.deepEqual(errors,[]);console.log('Responsive UI passed',viewport.width+'x'+viewport.height);await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
