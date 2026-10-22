const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright'),{server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true}),base='http://127.0.0.1:'+server.address().port;
 try{
  for(const viewport of [{width:1560,height:980},{width:933,height:430},{width:844,height:390}]){
   const context=await browser.newContext({viewport,isMobile:viewport.width<1000,hasTouch:viewport.width<1000}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('.diff[data-diff="normal"]').click();
   const result=await page.evaluate(()=>{
    G.paused=true;G.players.forEach(p=>{p.ai=null;p.gold=10000;});const p=localPlayer();buyFighter(p,'gnoll_warrior',5,7);const f=p.fighters[0];f.hp=f.max*.7;
    for(let i=0;i<24;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=f.x+(i%6-2.5)*9;e.y=f.y+(Math.floor(i/6)-1.5)*9;e.boss=true;}
    const dead=p.enemies[0];dead.x=f.x+42;dead.y=f.y+30;const before=p.gold;rewardEnemy(p,dead);rewardEnemy(p,dead);dead.hp=0;
    addPuff(f.x,f.y-20,'#ff0000',75);setMapView('local');
    const oldImage=CTX.drawImage,oldText=CTX.fillText,oldHealth=drawFighterHealth;let serial=0,lastSprite=0;const bars=[],texts=[];
    CTX.drawImage=function(...args){if(args[0]!==FOG_SKIN.canvas)lastSprite=++serial;return oldImage.apply(this,args);};
    CTX.fillText=function(txt,...args){texts.push(String(txt));return oldText.call(this,txt,...args);};
    drawFighterHealth=function(...args){bars.push(++serial);return oldHealth(...args);};
    draw(1000);
    const ordered=bars.length>0&&bars.every(n=>n>lastSprite),firstLabel=texts.includes(`${Math.ceil(f.hp)}/${Math.ceil(f.max)}`),coinRendered=texts.includes(`+${dead.bounty} 金`);
    const v=getMapProjection(),bw=Math.max(28,24/v.scale),bh=Math.max(4,3/v.scale);
    const x=Math.floor((v.tx+(f.x-bw/2+2)*v.scale)*v.dpr),y=Math.floor((v.ty+(f.y-27+bh/2)*v.scale)*v.dpr);
    const pixel=[...CTX.getImageData(x,y,1,1).data];
    f.hp=f.max*.2;texts.length=0;draw(1000);const updated=texts.includes(`${Math.ceil(f.hp)}/${Math.ceil(f.max)}`);
    CTX.drawImage=oldImage;CTX.fillText=oldText;drawFighterHealth=oldHealth;draw(1000);
    return {ordered,firstLabel,updated,coinRendered,pixel,gold:p.gold-before,bounty:dead.bounty,coins:G.floaters.filter(f=>f.kind==='gold').length};
   });
   assert.equal(result.ordered,true);assert.equal(result.firstLabel,true);assert.equal(result.updated,true);assert.equal(result.coinRendered,true);assert.deepEqual(result.pixel,[111,220,124,255]);assert.equal(result.gold,result.bounty);assert.equal(result.coins,1);
   if(process.argv[3]){fs.mkdirSync(process.argv[3],{recursive:true});await page.screenshot({path:path.join(process.argv[3],`combat-feedback-${viewport.width}.png`)});}
   const kingResult=await page.evaluate(()=>{
    const k=G.kings[0];k.hp=1234;MapCamera.cx=k.x;MapCamera.cy=k.y;
    for(const e of localPlayer().enemies){e.x=k.x;e.y=k.y-40;}
    addPuff(k.x,k.y-40,'#ffffff',90);
    const original=drawKingHealth,oldImage=CTX.drawImage,oldText=CTX.fillText;let order=0,lastSprite=0;const bars=[],labels=[];
    CTX.drawImage=function(...args){if(args[0]!==FOG_SKIN.canvas)lastSprite=++order;return oldImage.apply(this,args);};
    CTX.fillText=function(text,...args){labels.push(String(text));return oldText.call(this,text,...args);};
    drawKingHealth=function(...args){bars.push(++order);return original(...args);};draw(1000);
    const above=bars.length===2&&bars.every(n=>n>lastSprite),current=labels.some(s=>s.includes('1234/2600'));
    labels.length=0;k.hp=987;draw(1000);const updated=labels.some(s=>s.includes('987/2600'));
    drawKingHealth=original;CTX.drawImage=oldImage;CTX.fillText=oldText;draw(1000);return {above,current,updated};
   });
   assert.deepEqual(kingResult,{above:true,current:true,updated:true});
   if(process.argv[3])await page.screenshot({path:path.join(process.argv[3],`king-health-${viewport.width}.png`)});
   assert.deepEqual(errors,[]);console.log('Fighter and king health overlays, live numbers and kill gold passed',viewport);await context.close();
  }
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
