const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:1050},{width:390,height:844},{width:933,height:430}]){
   const mobile=viewport.width<900||viewport.height<=600,context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.diff[data-diff="normal"]').click();
   await page.evaluate(()=>{
    G.paused=true;G.players.forEach(p=>{p.ai=null;p.gold=2000;});const p=localPlayer();
    for(const [i,uid] of ['gnoll_warrior','gnoll_warrior','infantry','ranger'].entries())buyFighter(p,uid,4+i,7+i%2);
    startCombat();G.players.forEach(p=>{p.spawnList=[];p.paid=true;});p.paid=false;
    for(let i=0;i<4;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=p.gx+(4.5+i)*CFG.CELL;e.laneX=e.x;e.y=p.gy+6*CFG.CELL;e.hp=e.max=2000;e.speed=30;}
    window.beforePositions=p.fighters.map(f=>({x:f.x,y:f.y}));
    for(let i=0;i<50;i++)simStep(.04);
    setMapView(mobileView()?'local':'field');updateUI(true);draw(performance.now());
    function mobileView(){return CommandUI.mobile;}
   });
   assert.equal(await page.evaluate(()=>localPlayer().fighters.some((f,i)=>Math.hypot(f.x-beforePositions[i].x,f.y-beforePositions[i].y)>5)),true);
   assert.equal(await page.evaluate(()=>localPlayer().enemies.some(e=>e.hp<e.max)),true);
   const point=await page.evaluate(()=>{const f=localPlayer().fighters[0],v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+f.x*v.scale,y:r.top+v.ty+f.y*v.scale,id:f.entityId};});
   if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
   await page.locator('#panel-inspect').waitFor({state:'visible'});
   assert.equal(await page.evaluate(()=>G.selectedFighter.entityId),point.id);
   assert.match(await page.locator('#selLiveStats').textContent(),/移速/);
   if(mobile){await page.locator('#btnPanelClose').tap();await page.locator('#side').waitFor({state:'hidden'});}
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,`roads-defense-${viewport.width}.png`)});}
   assert.deepEqual(errors,[]);console.log('Moving defenders UI passed',viewport.width+'x'+viewport.height);await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
