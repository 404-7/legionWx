const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const createGame=require('../server/game.cjs');
function engine(){const c=vm.createContext({}),run=s=>vm.runInContext(s,c);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=10000;});");return run;}
test('creeps at both T-junctions can pursue defenders in the other friendly field from all four lanes',()=>{
 for(const id of [0,1,2,3]){
  const run=engine();run(`G.phase='combat';const p=G.players[${id}],ally=G.players[${id^1}],k=G.kings[p.team];buyFighter(ally,'ent',4,0);const f=ally.fighters[0];f.x=p.exitX+(p.team===0?-50:50);f.y=ally.fy+(ally.id%2?36:CFG.FIELD_H-36);f.hp=f.max=100000;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=p.exitX;e.y=CFG.ROAD_Y;leak(p,e);k.cd=100000;`);
  assert.equal(run('defenseWalkable(p,f.x,f.y)'),true);
  for(let i=0;i<160;i++)run('kingStep(k,.05)');
  assert.ok(run('f.hp')<100000,'a creep must actually reach and hit its target');
  assert.ok(run('Math.hypot(e.x-p.exitX,e.y-CFG.ROAD_Y)')>30,'no permanent corner lock');
  assert.equal(run('defenseWalkable(p,CFG.W/2,CFG.ROAD_Y)'),false,'closed bridge remains blocked');
 }
});
test('an unreachable off-road target cannot trap a leaked creep at the junction',()=>{
 const run=engine();run("G.phase='combat';const p=G.players[0],k=G.kings[0];buyFighter(p,'ent',0,0);const f=p.fighters[0];f.x=1400;f.y=660;f.hp=f.max=100000;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=p.exitX;e.y=CFG.ROAD_Y;leak(p,e);k.cd=100000;const hp=k.hp;");
 assert.equal(run('defenseWalkable(p,f.x,f.y)'),false);
 for(let i=0;i<600;i++)run('kingStep(k,.05)');
 assert.ok(run('k.hp')<run('hp'),'after ignoring an unreachable defender, the creep continues to the king');
});
test('a zero-progress chase times out and resumes the king route instead of freezing forever',()=>{
 const run=engine();run("G.phase='combat';const p=G.players[0],k=G.kings[0];buyFighter(p,'ent',0,0);const f=p.fighters[0];f.x=p.exitX;f.y=CFG.ROAD_Y-100;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=p.exitX;e.y=CFG.ROAD_Y;leak(p,e);k.cd=100000;const realMove=moveCombatUnit;moveCombatUnit=()=>false;");
 for(let i=0;i<200;i++)run('kingStep(k,.05)');
 assert.ok(run('Math.hypot(e.x-p.exitX,e.y-CFG.ROAD_Y)')>20);
 assert.ok(run('e.brain.chase')<8);
});
test('dense simultaneous leaks from both lanes reach and damage each king',()=>{
 const run=engine();run("G.phase='combat';G.kings.forEach(k=>{k.cd=100000;k.hp=k.max=10000000;});for(const p of G.players)for(let i=0;i<36;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=p.exitX+(i%3-1)*7;e.y=p.exitY;leak(p,e);}");
 for(let i=0;i<650;i++)run('G.players.forEach(p=>separateDefenseUnits(p,.05));G.kings.forEach(k=>kingStep(k,.05));');
 assert.equal(run('G.kings.every(k=>k.hp<k.max)'),true);
 assert.equal(run('G.kings.every(k=>k.leaks.every(e=>e.routeIndex>=2&&Math.hypot(e.x-k.x,e.y-k.y)<100))'),true);
});

test('subpixel attack-range rounding cannot leave a creep standing just outside its target forever',()=>{
 const run=engine();run("G.phase='combat';const p=G.players[2];buyFighter(p,'ent',0,0);const f=p.fighters[0];f.x=p.exitX;f.y=CFG.ROAD_Y;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=f.x+e.range+e.r+1e-10;e.y=f.y;e.cd=0;const hp=f.hp;enemyAct(p,e,.05);");
 assert.ok(run('f.hp')<run('hp'));assert.equal(run('e.brain.state'),'attack');
});

test('a blocked route forgets its target after the no-progress deadline',()=>{
 const run=engine();run("G.phase='combat';const p=G.players[0];buyFighter(p,'ent',0,0);const f=p.fighters[0];f.x=1400;f.y=660;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=p.exitX;e.y=CFG.ROAD_Y;combatAgent(f);combatAgent(e);e.brain.targetId=f.entityId;const options={sense:150,reach:39,x:e.x,y:e.y,leash:280};");
 for(let i=0;i<30;i++)run('moveCombatUnit(p,e,f,e.speed,.05,39);chooseCombatTarget(e,[f],options,.05);');
 assert.equal(run('e.brain.targetId'),null);assert.ok(run('e.brain.ignore')>0);
});
test('all sales use 30 percent of actual cumulative investment rounded down, including refund-passive units',()=>{
 const run=engine();
 for(const [spent,expected] of [[1,0],[10,3],[35,10],[115,34],[333,99]])assert.equal(run(`fighterSellValue({spent:${spent}})`),expected);
 for(const uid of ['ent','bottom_feeder','king_claw']){
  run(`const def_${uid}=UNITS['${uid}'];const p_${uid}=G.players[0];const f_${uid}={uid:'${uid}',def:def_${uid},spent:333,temporary:false,x:0,y:0};p_${uid}.fighters.push(f_${uid});const gold_${uid}=p_${uid}.gold;`);
  assert.equal(run(`sellFighter(p_${uid},f_${uid})`),true);assert.equal(run(`p_${uid}.gold-gold_${uid}`),99);
  assert.equal(run(`sellFighter(p_${uid},f_${uid})`),false);
 }
 const game=createGame([{slot:0,name:'a',race:'nature'},{slot:2,name:'b',race:'nature'}],{raceMode:'select'});
 assert.equal(game.action(0,{type:'buy',uid:'ent',col:0,row:0}),true);assert.equal(game.action(0,{type:'upgrade',col:0,row:0}),true);
 const before=game.snapshot().players[0],spent=before.fighters[0].spent;
 assert.equal(game.action(2,{type:'sell',col:0,row:0,refund:100000}),false);
 assert.equal(game.action(0,{type:'sell',col:0,row:0,refund:100000}),true);
 assert.equal(game.snapshot().players[0].gold-before.gold,Math.floor(spent*3/10));
});

test('allied guards can retaliate against other-lane leaks without ticking their poison twice',()=>{
 const run=engine();run("G.phase='combat';const p=G.players[0],ally=G.players[1];buyFighter(ally,'ent',4,0);const f=ally.fighters[0];f.x=1450;f.y=824;spawnEnemy(p,{type:'wave'});const e=p.enemies[0];e.x=1500;e.y=720;e.hp=e.max=100000;leak(p,e);add341Status(e,'testPoison',{time:3,dps:10});const hp=e.hp;fieldStep(p,.1);fieldStep(ally,.1);");
 assert.equal(run('f.brain.targetId'),run('e.entityId'));
 assert.ok(Math.abs(run('hp-e.hp')-1)<1e-8,'one simulation owner ticks poison');
 assert.ok(Math.abs(run('e.statuses.testPoison.time')-2.9)<1e-8);
});
