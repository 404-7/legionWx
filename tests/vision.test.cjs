const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const createGame=require('../server/game.cjs');
function engine(){const c=vm.createContext({}),run=s=>vm.runInContext(s,c);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=10000;});");return run;}
test('both factions hide opposing fields and outer lanes while exposing king approaches and the PK bridge',()=>{
 const run=engine();
 for(const team of [0,1]){
  run(`globalThis.team=${team};globalThis.enemy=G.players.find(p=>p.team!==team);globalThis.k=G.kings[1-team];`);
  assert.equal(run('pointVisibleToTeam(G,team,enemy.gx+100,enemy.gy+100)'),false);
  assert.equal(run('pointVisibleToTeam(G,team,enemy.exitX,enemy.spawnY)'),false);
  assert.equal(run('pointVisibleToTeam(G,team,k.x,k.y)'),true);
  assert.equal(run('pointVisibleToTeam(G,team,k.x,(k.y+CFG.ROAD_Y)/2)'),true);
  assert.equal(run('pointVisibleToTeam(G,team,(enemy.exitX+k.x)/2,CFG.ROAD_Y)'),true);
  assert.equal(run('pointVisibleToTeam(G,team,CFG.W/2,CFG.ROAD_Y)'),true);
  assert.equal(run('G.players.filter(p=>p.team===team).every(p=>pointVisibleToTeam(G,team,p.gx+100,p.gy+100))'),true);
 }
});
test('scoped snapshots omit hidden enemy armies, economy, mines, effects and private logs but retain public road units',()=>{
 const run=engine();run("for(const p of G.players){buyFighter(p,'ent',0,0);buyMine(p);}const enemy=G.players[2],f=enemy.fighters[0];buyFighter(enemy,'ent',1,0);const road=enemy.fighters[1];road.x=600;road.y=CFG.ROAD_Y;G.fx=[{x:f.x,y:f.y,color:'red'},{x:600,y:720,color:'blue'}];G.floaters=[{x:f.x,y:f.y,txt:'private'},{x:600,y:720,txt:'public'}];G.projectiles=[{x:f.x,y:f.y,px:f.x,py:f.y},{x:600,y:720,px:610,py:720}];addLog('red-private','',1);addLog('blue-private','',0);addLog('public');const original=JSON.stringify(G);const view=scopeBattleSnapshot(JSON.parse(original),0);");
 assert.equal(run('view.players[0].fighters.length'),1);assert.equal(run('view.players[1].fighters.length'),1);
 assert.equal(run('view.players[2].fighters.length'),1);assert.equal(run('view.players[2].fighters[0].x'),600);
 for(const key of ['col','row','spent','homeX','homeY','brain','route'])assert.equal(run(`view.players[2].fighters[0].${key}`),undefined);
 assert.equal(run('view.players[2].gold'),null);assert.equal(run('view.players[2].income'),null);assert.equal(run('view.players[2].mines.length'),0);
 assert.equal(run('view.fx.length'),1);assert.equal(run('view.floaters[0].txt'),'public');assert.equal(run('view.projectiles.length'),1);
 assert.equal(run('view.logLines.some(l=>l.txt==="red-private")'),false);assert.equal(run('view.logLines.some(l=>l.txt==="blue-private")'),true);
 assert.equal(run('JSON.stringify(G)===original'),true);
});
test('an enemy PK unit becomes visible on the public approach and disappears when it returns to formation',()=>{
 const run=engine();run("const p=G.players[2];buyFighter(p,'ent',0,0);const f=p.fighters[0];const home={x:f.x,y:f.y};G.battleMode='arena';G.arena={counts:[0,1]};G.phase='prep';");
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).players[2].fighters.length'),0);
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).arena.counts[1]'),null);
 run('G.phase="combat";f.x=820;f.y=720;');
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).players[2].fighters.length'),1);
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).arena.counts[1]'),1);
 run('f.x=home.x;f.y=home.y;G.battleMode="defense";G.phase="prep";');
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).players[2].fighters.length'),0);
 run('G.phase="over";');
 assert.equal(run('scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0).players[2].fighters.length'),1);
});
test('server player views are faction-specific without mutating the authoritative simulation',()=>{
 const game=createGame([0,1,2].map(slot=>({slot,name:'P'+slot,race:'nature'})),{raceMode:'select'});
 assert.equal(game.action(0,{type:'buy',uid:'ent',col:0,row:0}),true);
 assert.equal(game.action(2,{type:'buy',uid:'ent',col:0,row:0}),true);
 assert.equal(game.snapshot(0).players[2].fighters.length,0);assert.equal(game.snapshot(2).players[0].fighters.length,0);
 assert.equal(game.snapshot(1).players[0].fighters.length,1);assert.equal(game.snapshot().players[2].fighters.length,1);
 assert.equal(game.snapshot().players[0].gold,280);
});

test('teammate income is always shared; PK reveals opposing income only until defense resumes',()=>{
 const run=engine();run('G.players.forEach((p,i)=>p.income=10+i*7)');
 for(const team of [0,1]){
  run(`globalThis.viewerTeam=${team};globalThis.slot=${team*2};globalThis.scope=()=>scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),slot)`);
  for(const phase of ['prep','combat']){
   run(`G.battleMode='defense';G.phase='${phase}'`);
   assert.equal(run('scope().players.filter(p=>p.team===viewerTeam).every(p=>p.income===10+p.id*7)'),true);
   assert.equal(run('scope().players.filter(p=>p.team!==viewerTeam).every(p=>p.income===null)'),true);
  }
  for(const stage of ['prep','march','fight','result']){
   run(`G.battleMode='arena';G.phase='${stage==='prep'?'prep':'combat'}';G.arena={stage:'${stage}',counts:[0,0]}`);
   assert.equal(run('scope().players.every(p=>p.income===10+p.id*7)'),true);
   assert.equal(run('scope().players.filter(p=>p.team!==viewerTeam).every(p=>p.gold===null&&p.mines.length===0)'),true);
  }
  run("G.battleMode='defense';G.phase='prep';G.arena=null");
  assert.equal(run('scope().players.filter(p=>p.team!==viewerTeam).every(p=>p.income===null)'),true);
  assert.equal(run('G.players.every(p=>p.income===10+p.id*7)'),true);
 }
});

test('kill gold floaters pay and appear exactly once, including king-road kills, respecting fog',()=>{
 const run=engine();run("const p=G.players[0];spawnEnemy(p,{type:'wave'});const e=p.enemies[0],before=p.gold;rewardEnemy(p,e);rewardEnemy(p,e)");
 assert.equal(run('p.gold-before'),run('e.bounty'));
 assert.equal(run('G.floaters.filter(f=>f.kind==="gold").length'),1);
 assert.equal(run('G.floaters[0].txt'),run('`+${e.bounty} 金`'));
 run("spawnEnemy(p,{type:'wave'});const road=p.enemies.at(-1);leak(p,road);road.x=G.kings[0].x;road.y=G.kings[0].y;road.hp=0;kingStep(G.kings[0],.01);kingStep(G.kings[0],.01)");
 assert.equal(run('G.floaters.filter(f=>f.kind==="gold").length'),2);
 run("const red=G.players[2];spawnEnemy(red,{type:'wave'});const hidden=red.enemies[0];rewardEnemy(red,hidden);rewardEnemy(red,{x:600,y:720,r:10,bounty:9});const view=scopeBattleSnapshot(JSON.parse(JSON.stringify(G)),0)");
 assert.equal(run('view.floaters.some(f=>f.kind==="gold"&&f.x===hidden.x&&f.y===hidden.y-hidden.r-18)'),false);
 assert.equal(run('view.floaters.some(f=>f.kind==="gold"&&f.txt==="+9 金")'),true);
 run("const n=G.floaters.length;rewardEnemy(p,{x:100,y:100,r:10,bounty:0})");assert.equal(run('G.floaters.length'),run('n'));
});
