const {test}=require('node:test'),assert=require('node:assert/strict'),engine=require('./helpers/native-engine.cjs');
test('eight defense areas and creep spawns use the extracted original rectangles, with four western and four eastern players',()=>{
 const run=engine();assert.equal(run('G.players.every(p=>p.team===(p.id<4?0:1))'),true);
 assert.equal(run('G.players.every(p=>{const r=SOURCE341.rules.native.map.rects["P"+(p.id+1)+"BuildArea"],m=SOURCE341.rules.native.map;return p.gx===(r[0]-m.minX)*m.scale&&p.gy===(m.maxY-r[3])*m.scale})'),true);
 assert.equal(run('G.players.every(p=>p.team===0?p.spawnX<CFG.W/2:p.spawnX>CFG.W/2)'),true);
});
test('normal waves still spawn every 0.1 seconds, with 36 units in each of eight lanes after 3.6 seconds',()=>{
 const run=engine();run('startCombat();for(let i=0;i<36;i++)simStep(.1)');assert.equal(run('G.players.every(p=>p.enemies.length===36&&!p.spawnList.length)'),true);assert.equal(run('G.players.flatMap(p=>p.enemies).length'),288);
});
test('leaked creeps teleport to their source king-spawn rectangle and never use the removed central gate route',()=>{
 const run=engine();run('spawnEnemy(p,{type:"wave"});globalThis.e=p.enemies[0];leak(p,e);globalThis.area=nativeRect341("LKingSpawn")');assert.equal(run('p.enemies.length'),0);assert.equal(run('k.leaks[0]===e'),true);
 assert.equal(run('e.x>=area.x&&e.x<=area.x+area.w&&e.y>=area.y&&e.y<=area.y+area.h'),true);assert.equal(run('e.route.length'),1);assert.equal(run('e.route[0].x===k.x&&e.route[0].y===k.y'),true);
});
test('dense leaks from all four allied lanes continue moving and attack each king without a shared T-junction deadlock',()=>{
 const run=engine();run("G.phase='combat';for(const k of G.kings){k.hp=k.max=1e9;k.cd=1e9;}for(const p of G.players)for(let i=0;i<12;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.hp=e.max=10000;leak(p,e);}for(let i=0;i<250;i++){for(const k of G.kings)kingStep(k,.1);stepProjectiles341(.1)}");
 assert.equal(run('G.kings.every(k=>k.hp<k.max)'),true);assert.equal(run('G.kings.every(k=>k.leaks.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.y)))'),true);
});
test('MM masks the entire opposing region including its king approach; PK/final survival reveals the battlefield',()=>{
 const run=engine();assert.equal(run('pointVisibleToTeam(G,0,G.kings[1].x,G.kings[1].y)'),false);assert.equal(run('pointVisibleToTeam(G,0,G.players[4].gx,G.players[4].gy)'),false);assert.equal(run('pointVisibleToTeam(G,0,p.gx,p.gy)'),true);
 run("G.battleMode='arena'");assert.equal(run('pointVisibleToTeam(G,0,G.players[4].gx,G.players[4].gy)'),true);run("G.battleMode='defense';G.bonus={}");assert.equal(run('visionOpen(G)'),true);
});
test('scoped state removes hidden enemy buildings, wood, workers, research, armies and effects without mutating authority',()=>{
 const run=engine();run("chooseBuilder341(G.players[4],'nature');buyReady341(G.players[4],'ent',0,0);globalThis.before=JSON.stringify(G);globalThis.view=scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0)");
 for(const field of ['gold','wood','workers','lumberLevel'])assert.equal(run(`view.players[4].${field}`),null);for(const field of ['towers','fighters','workerQueue','workerHarvest'])assert.equal(run(`view.players[4].${field}.length`),0);assert.equal(run('JSON.stringify(G)===before'),true);
});
test('arena transfers both teams to source top/bottom areas, waits for the native countdown, settles once and resumes defense',()=>{
 const run=engine();run("p.gold=10000;chooseBuilder341(p,'mech');buyReady341(p,'infantry',0,0);upgradeReady341(p,p.towers[0],'zeus');chooseBuilder341(G.players[4],'nature');buyReady341(G.players[4],'ent',0,0);G.wave=10;startArenaPrep();startCombat();globalThis.before=G.players.map(p=>p.gold)");
 assert.equal(run('G.arena.countdown'),5.5);assert.equal(run('G.players[0].fighters[0].y>=nativeRect341("ArenaTopBig").y'),true);assert.equal(run('G.players[4].fighters[0].y>=nativeRect341("ArenaBotBig").y'),true);
 const y=run('p.fighters[0].y');run('arenaStep(5)');assert.equal(run('p.fighters[0].y'),y);run('arenaStep(.5);for(let i=0;i<6000&&G.arena.stage!=="result";i++)arenaStep(.1)');assert.equal(run('G.arena.stage'),'result');assert.equal(run('G.arena.winner'),0);
 assert.equal(run('p.gold-before[0]'),0);run('arenaStep(2);finishArena(0)');assert.equal(run('p.gold-before[0]'),100);run('arenaStep(20)');assert.equal(run('G.wave'),11);assert.equal(run('G.timer'),30);assert.equal(run('p.fighters===p.towers'),true);assert.equal(run('p.fighters[0].hp'),run('p.fighters[0].max'));
});
test('wave 30 pays its source completion bonus twice and moves to the 60-second survival preparation exactly once',()=>{
 const run=engine();run('G.wave=30;G.waveDef=waveDefFor(30);G.phase="combat";globalThis.before=p.gold;endWave()');assert.equal(run('p.gold-before'),800);assert.equal(run('G.wave'),31);assert.equal(run('G.timer'),60);
});
test('source magic/armor, full/half/quarter splash and ground-only targeting remain active after layout migration',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);globalThis.f=p.fighters[0];f.hp=f.max=10000;f.effArmor=100;hitFighter(p,f,100,'法术');for(const [x,air] of [[0,false],[1,false],[8,false],[20,false],[8,true]]){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=x;e.y=0;e.hp=e.max=1000;e.armor='无甲';e.armorPoints=0;e.air=air;}afterHits(p,p.enemies[0],100,'混乱',UNITS.dwarven_engineer.abil,f)");
 assert.equal(run('f.hp'),9900);assert.equal(run('p.enemies[1].hp'),900);assert.equal(run('p.enemies[2].hp'),950);assert.ok(Math.abs(run('p.enemies[3].hp')-985)<1e-5);assert.equal(run('p.enemies[4].hp'),1000);
});
test('all imported fighters and summons can execute spells, attacks and death handlers without NaN or cyclic state',()=>{
 const run=engine();run(`G.phase='combat';for(const def of Object.values(UNITS)){
  p.towers=[];p.fighters=[];p.enemies=[];G.projectiles=[];G.skillWaves=[];
  const f={def,uid:def.id,ownerId:0,col:0,row:0,x:p.gx+100,y:p.gy+100,hp:def.hp,max:def.hp,cd:0,spent:0,effDmg:def.dmg,deadT:0,flash:0,r:10};p.fighters.push(f);init341Fighter(f);f.mana=def.manaMax;
  for(let i=0;i<4;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=f.x+20+i*5;e.y=f.y;e.hp=e.max=1e6;e.speed=0;}
  for(let i=0;i<20;i++){tick341(p,.1);fighterAct(p,f,.1);stepProjectiles341(.1);}
  f.hp=0;death341(p,f);if(!p.fighters.every(f=>[f.hp,f.max,f.x,f.y,f.mana].every(Number.isFinite)))throw Error(def.id);JSON.stringify(G);
 }`);
});
