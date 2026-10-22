const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
const output=process.argv[3]&&path.resolve(process.argv[3]);
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1560,height:980},{width:933,height:430}]){
   const mobile=viewport.width<1000,ctx=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('.diff[data-diff="normal"]').click();
   const result=await page.evaluate(()=>{
    G.paused=true;G.players.forEach(p=>{p.ai=null;p.mercQueue=Array(40).fill('militia');});
    G.wave=11;G.waveDef=waveDefFor(11);startCombat();
    const begin=performance.now();for(let i=0;i<108;i++)simStep(.05);const simMs=performance.now()-begin;
    updateUI(true);setMapView('overview');const render=performance.now();for(let i=0;i<30;i++)draw(performance.now());
    return {count:G.players.reduce((n,p)=>n+p.enemies.length,0),pending:G.players.reduce((n,p)=>n+p.spawnList.length+p.mercSpawnList.length,0),simMs,renderMs:(performance.now()-render)/30};
   });
   assert.equal(result.count,376);assert.equal(result.pending,0);assert.deepEqual(errors,[]);
   if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,`wave-density-${viewport.width}.png`)});}
   console.log('Dense wave rendered',viewport,result);await ctx.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
