const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function engine(){const ctx=vm.createContext({}),run=code=>vm.runInContext(code,ctx);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=100000;})");return run;}

test('expanded grid accepts its far corner and armies beyond 36 units require source farm capacity',()=>{
 const run=engine();assert.equal(run('CFG.COLS*CFG.ROWS'),192);
 assert.equal(run("buyFighter(G.players[0],'ent',11,15)"),true);
 assert.equal(run("buyFighter(G.players[0],'ent',12,15)"),false);
 assert.equal(run("buyFighter(G.players[0],'ent',11,16)"),false);
 const game=require('../server/game.cjs')([0,1,2,3].map(slot=>({slot,name:'P'+slot,race:'beast'})),{raceMode:'select'});
 assert.equal(game.action(0,{type:'farmUpgrade'}),true);
 assert.equal(game.snapshot().players[0].farmLevel,1);assert.equal(game.snapshot().players[0].gold,196);
 run('while(foodCapacity341(G.players[0])<60)farmUpgrade341(G.players[0])');
 for(let i=0;i<40;i++)assert.equal(run(`buyFighter(G.players[0],'gnoll_warrior',${i%12},${Math.floor(i/12)})`),true);
 assert.equal(run('G.players[0].fighters.length'),41);
});

test('only waves 10 and 20 insert a 30-second PK prep without double income or wave rewards',()=>{
 for(const wave of [9,10,20,30]){
  const run=engine();run(`G.wave=${wave};G.waveDef=waveDefFor(G.wave);G.phase='combat';G.players.forEach(p=>p.paid=true);endWave()`);
  assert.equal(run('G.battleMode'),[10,20].includes(wave)?'arena':'defense');
  assert.equal(run('G.wave'),[10,20].includes(wave)?wave:wave+1);
  if([10,20].includes(wave)){
   assert.equal(run('G.timer'),30);assert.equal(run('G.players[0].gold'),100000+run('G.waveDef.bonus'));
   run('simStep(30)');assert.equal(run('G.phase'), 'combat');assert.equal(run('G.arena.stage'),'march');
   assert.equal(run('G.players.every(p=>!p.spawnList.length&&!p.enemies.length)'),true);
  }
 }
});

test('PK follows team roads, fights real opposing units, settles once and restores both formations',()=>{
 const run=engine();run("buyFighter(G.players[0],'infantry',5,7);upgradeFighter(G.players[0],G.players[0].fighters[0],'zeus');buyFighter(G.players[2],'ent',5,7);G.wave=10;startArenaPrep();startCombat()");
 const startX=run('G.players[0].fighters[0].x');run('arenaStep(.5)');assert.notEqual(run('G.players[0].fighters[0].x'),startX);
 assert.equal(run("buyFighter(G.players[0],'ent',0,0)"),false);
 assert.equal(run('sellFighter(G.players[0],G.players[0].fighters[0])'),false);
 assert.equal(run("upgradeFighter(G.players[2],G.players[2].fighters[0],'guardian')"),false);
 run('globalThis.initialGold=G.players.map(p=>p.gold);globalThis.kingHP=G.kings.map(k=>k.hp);for(let i=0;i<2200&&G.arena.stage!=="result";i++)arenaStep(.1)');
 assert.equal(run('G.arena.stage'),'result');assert.equal(run('G.arena.winner'),0);
 assert.equal(run('G.players[0].gold-initialGold[0]'),100);assert.equal(run('G.players[1].gold-initialGold[1]'),100);
 assert.equal(run('G.players[2].gold-initialGold[2]'),0);
 assert.equal(run('JSON.stringify(G.kings.map(k=>k.hp))===JSON.stringify(kingHP)'),true);
 assert.equal(run('G.result'),null);assert.equal(run('G.arenaHistory.length'),1);
 run('finishArena(0)');assert.equal(run('G.players[0].gold-initialGold[0]'),100);
 run('simStep(5)');assert.equal(run('G.phase'),'prep');assert.equal(run('G.wave'),11);assert.equal(run('G.battleMode'),'defense');
 assert.equal(run('G.players.every(p=>p.fighters.every(f=>f.hp===f.max&&f.x===p.gx+(f.col+.5)*CFG.CELL&&f.y===p.gy+(f.row+.5)*CFG.CELL))'),true);
 assert.equal(run('G.players[2].fighters.length'),1);assert.doesNotThrow(()=>JSON.parse(run('JSON.stringify(G)')));
});

test('PK resolves empty teams, simultaneous elimination and timeout as round results',()=>{
 for(const scenario of ['empty','both','timeout']){
  const run=engine();run("buyFighter(G.players[0],'ent',0,0);buyFighter(G.players[2],'ent',0,0);G.wave=20;startArenaPrep();startCombat();globalThis.before=G.players.map(p=>p.gold)");
  if(scenario==='empty')run('G.players[2].fighters[0].hp=0');
  if(scenario==='both')run('G.players.forEach(p=>p.fighters.forEach(f=>f.hp=0))');
  if(scenario==='timeout')run('G.arena.elapsed=CFG.ARENA_LIMIT');
  run('arenaStep(.01)');assert.equal(run('G.arena.stage'),'result');assert.equal(run('G.result'),null);
  assert.equal(run('G.arena.winner'),scenario==='empty'?0:null);
  assert.equal(run('G.players[0].gold-before[0]'),scenario==='empty'?200:100);
 }
});

test('reincarnation and death summons keep a PK team alive before elimination checks',()=>{
 const run=engine();run("buyFighter(G.players[0],'ent',0,0);buyFighter(G.players[2],'ent',0,0);G.wave=10;startArenaPrep();startCombat();const f=G.players[0].fighters[0];f.def={...f.def,abil:{reinc:true}};hitFighter(G.players[0],f,100000,'混乱',null);arenaStep(.1)");
 assert.equal(run('G.arena.counts[0]'),1);assert.notEqual(run('G.arena.stage'),'result');
 run("const g=G.players[2].fighters[0];g.def={...g.def,abil:{deathSummon:{id:'ent',count:2}}};g.hp=0;arenaStep(.1)");
 assert.equal(run('G.players[2].fighters.filter(f=>f.temporary&&f.hp>0).length'),2);
 assert.equal(run('G.arena.counts[1]'),2);assert.notEqual(run('G.arena.stage'),'result');
 assert.doesNotThrow(()=>JSON.parse(run('JSON.stringify(G)')));
});

test('all 187 imported unit records can cast, attack and summon against real opposing fighters',()=>{
 const run=engine();
 run(`for(const slot of [0,2])for(const [i,row] of SOURCE341.units.entries()){
  // Deliberately oversized stress fixture; real purchases obey the 200 food ceiling.
  const p=G.players[slot],def=UNITS[row.id],f={uid:row.id,def,ownerId:p.id,col:i%CFG.COLS,row:Math.floor(i/CFG.COLS),x:p.gx,y:p.gy,hp:def.hp,max:def.hp,cd:0,spent:0,effDmg:def.dmg,deadT:0,flash:0};
  p.fighters.push(f);init341Fighter(f);
 }
 G.wave=20;startArenaPrep();startCombat();
 for(const p of G.players)for(const [i,f] of p.fighters.entries()){
  f.route=[];f.routeIndex=0;f.arenaReady=true;f.x=(p.team===0?940:860)+(i%8)*3;f.y=660+Math.floor(i/8)*4;f.mana=f.def.manaMax;
 }
 for(let i=0;i<30&&G.arena.stage!=='result';i++)arenaStep(.05);`);
 assert.equal(run('G.players.every(p=>p.fighters.every(f=>[f.hp,f.max,f.x,f.y,f.mana,f.cd].every(Number.isFinite)))'),true);
 assert.doesNotThrow(()=>JSON.parse(run('JSON.stringify(G)')));
});
