const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true}),base='http://127.0.0.1:'+server.address().port;
 try{for(const viewport of [{width:1560,height:980},{width:933,height:430}]){
  const mobile=viewport.width<1000,page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.diff[data-diff="normal"]').click();
  await page.evaluate(()=>{G.paused=true;setMapView('overview');if(CommandUI.mobile)closeCommandPanel();});
  if(process.argv[3]){fs.mkdirSync(process.argv[3],{recursive:true});await page.screenshot({path:path.join(process.argv[3],`roads-${viewport.width}.png`)});
   await page.evaluate(()=>{const p=localPlayer();setMapView(CommandUI.mobile?'local':'field');MapCamera.zoom=CommandUI.mobile ? .7 : .8;MapCamera.cx=p.exitX+80;MapCamera.cy=CommandUI.mobile?townPosition341(p).y:p.gy+CFG.GRID_H/2;});
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(process.argv[3],`defense-town-${viewport.width}.png`)});
  }
  const result=await page.evaluate(()=>{
   G.phase='combat';G.players.forEach(p=>{p.active=true;p.spawnList=[];});for(const k of G.kings){k.hp=k.max=1e9;k.cd=1e6;}
   const creeps=G.players.map(p=>{spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.speed=200;e.hp=e.max=1e6;return e;});
   let jumps=0,offRoad=0;for(let frame=0;frame<2000;frame++){
    const before=creeps.map(e=>({x:e.x,y:e.y}));for(const p of G.players)for(const e of [...p.enemies])enemyAct(p,e,.05);for(const k of G.kings)kingStep(k,.05);
    // A frame permits 10 units of walking plus at most 1.5 units of crowd separation.
    creeps.forEach((e,i)=>{if(Math.hypot(e.x-before[i].x,e.y-before[i].y)>11.501)jumps++;if(!defenseWalkable(G.players[i],e.x,e.y))offRoad++;});
    if(creeps.every((e,i)=>Math.hypot(e.x-G.kings[G.players[i].team].x,e.y-G.kings[G.players[i].team].y)<=e.range+e.r+27))break;
   }
   return {jumps,offRoad,reached:creeps.filter((e,i)=>Math.hypot(e.x-G.kings[G.players[i].team].x,e.y-G.kings[G.players[i].team].y)<=e.range+e.r+27).length};
  });
  assert.deepEqual(result,{jumps:0,offRoad:0,reached:8});assert.deepEqual(errors,[]);console.log('Road layout and eight uninterrupted spawn-to-king journeys passed',viewport);await page.close();
 }}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
