const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function engine(uid='gnoll_warrior'){
 const ctx=vm.createContext({}),run=code=>vm.runInContext(code,ctx);
 run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));
 run(`newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=10000;});globalThis.p=G.players[0];buyFighter(p,'${uid}',5,7);globalThis.f=p.fighters[0];startCombat();p.spawnList=[];spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.x=f.x+110;e.y=f.y;e.hp=e.max=100000;e.speed=0;f.cd=0;`);
 return run;
}

test('fighters retain map movement speed and every explicit acquisition range',()=>{
 const run=engine();assert.equal(run('SOURCE341.units.every(r=>UNITS[r.id].speed===r.map.moveSpeed*SOURCE341.rangeScale)'),true);
 assert.equal(run('SOURCE341.units.filter(r=>r.map.fields.uacq!==undefined).every(r=>UNITS[r.id].acquireRange===r.map.fields.uacq*SOURCE341.rangeScale)'),true);
});

test('melee defenders move before their attack cooldown expires, stop in reach and deal damage',()=>{
 const run=engine();run('globalThis.x0=f.x;f.cd=3;fighterAct(p,f,.1)');
 assert.ok(run('f.x>x0'));assert.ok(run('f.x-x0<=f.def.speed*.1+.0001'));
 run('for(let i=0;i<120;i++)fighterAct(p,f,.05)');
 assert.ok(run('e.hp<e.max'));assert.ok(run('Math.hypot(f.x-e.x,f.y-e.y)>=effRange(f.def)+e.r+12-.001'));
 assert.equal(run('f.col'),5);assert.equal(run('f.row'),7);
});

test('ranged defenders hold firing distance and resolve a cancellable attack windup',()=>{
 const run=engine('infantry');run('e.x=f.x+70;globalThis.x0=f.x;fighterAct(p,f,.01)');
 assert.equal(run('f.x'),run('x0'));assert.equal(run('G.projectiles.length'),0);assert.ok(run('f.brain.windup.time>0'));
 run('fighterAct(p,f,.05)');assert.equal(run('G.projectiles.length'),0);
 run('fighterAct(p,f,1)');assert.equal(run('G.projectiles.length'),1);
 run('f.cd=0;fighterAct(p,f,.01);e.hp=0;fighterAct(p,f,.05)');
 assert.equal(run('f.brain.windup'),null);assert.equal(run('G.projectiles.length'),1,'dead target must not receive a second projectile');
});

test('minimum lock resists nearby decoys; strong damage threat can retarget after the lock',()=>{
 const run=engine();run(`globalThis.options={sense:200,reach:60,x:f.x,y:f.y,leash:440,returnHome:true};
 chooseCombatTarget(f,[e],options,.01);globalThis.first=e.entityId;
 spawnEnemy(p,{type:'wave'});globalThis.decoy=p.enemies[1];decoy.x=f.x+8;decoy.y=f.y;
 chooseCombatTarget(f,p.enemies,options,.2);`);
 assert.equal(run('f.brain.targetId'),run('first'));
 run('recordCombatThreat(f,decoy,100);chooseCombatTarget(f,p.enemies,options,.5)');
 assert.equal(run('f.brain.targetId'),run('decoy.entityId'));
});

test('dead targets are replaced immediately and lost distant targets expire instead of being tracked forever',()=>{
 const run=engine();run(`globalThis.options={sense:150,reach:60,x:f.x,y:f.y,leash:440,returnHome:true};chooseCombatTarget(f,[e],options,.01);
 spawnEnemy(p,{type:'wave'});globalThis.other=p.enemies[1];other.x=f.x+90;other.y=f.y;e.hp=0;chooseCombatTarget(f,p.enemies,options,.01);`);
 assert.equal(run('f.brain.targetId'),run('other.entityId'));
 run('other.x=f.x+330;chooseCombatTarget(f,p.enemies,options,.5);chooseCombatTarget(f,p.enemies,options,.5);chooseCombatTarget(f,p.enemies,options,.5)');
 assert.equal(run('f.brain.targetId'),null);assert.equal(run('f.brain.returning'),true);
});

test('roots prevent movement and movement slows scale actual travel distance',()=>{
 const run=engine();run("globalThis.x0=f.x;add341Status(f,'root',{time:1,move:1});tick341(p,.1);fighterAct(p,f,.1)");
 assert.equal(run('f.x'),run('x0'));
 run("f.statuses={};add341Status(f,'slow',{time:2,move:.5});tick341(p,.1);fighterAct(p,f,.1)");
 assert.ok(Math.abs(run('f.x-x0')-run('f.def.speed*.05'))<.00001);
});

test('a moving target cannot kite a defender forever; chase timeout returns it to its formation',()=>{
 const run=engine();run(`f.def={...f.def,speed:1};e.x=f.x;e.y=f.y-110;
 for(let i=0;i<100&&!f.brain.returning;i++){e.y-=.1;fighterAct(p,f,.1);}`);
 assert.equal(run('f.brain.returning'),true);assert.equal(run('f.brain.state'),'return');
 run('p.enemies=[];for(let i=0;i<200;i++)fighterAct(p,f,.1)');
 assert.equal(run('f.brain.returning'),false);assert.ok(run('Math.hypot(f.x-guardHome(p,f).x,f.y-guardHome(p,f).y)<=COMBAT_AI.RETURN_EPS'));
});

test('navigation follows connected roads around mines and does not cross the closed bridge',()=>{
 const run=engine();run('f.x=G.kings[0].x;f.y=CFG.ROAD_Y;globalThis.goal=guardHome(p,f);globalThis.valid=true;for(let i=0;i<200;i++){moveCombatUnit(p,f,goal,100,.1,5);valid&&=defenseWalkable(p,f.x,f.y);}');
 assert.equal(run('valid'),true);assert.ok(run('Math.hypot(f.x-goal.x,f.y-goal.y)<7'));
 assert.equal(run('defenseWalkable(p,CFG.W/2,CFG.ROAD_Y)'),false);
 assert.equal(run('defenseWalkable(p,mineZone(p).x+80,mineZone(p).y+200)'),false);
});

test('defenders chase leaked creeps and the kill bounty settles exactly once',()=>{
 const run=engine();run(`f.x=p.exitX;f.y=p.exitY-14;f.homeX=f.x;f.homeY=f.y;e.x=p.exitX;e.y=p.exitY;e.hp=1;e.cd=10;
 leak(p,e);globalThis.gold=p.gold;for(let i=0;i<20;i++)fieldStep(p,.05);kingStep(G.kings[p.team],.05);`);
 assert.equal(run('G.kings[p.team].leaks.length'),0);assert.equal(run('p.gold-gold'),run('G.waveDef.bounty'));
 run('kingStep(G.kings[p.team],.1)');assert.equal(run('p.gold-gold'),run('G.waveDef.bounty'));
});

test('creep aggro sticks to a defender, responds to threat, and healing contributes bounded threat',()=>{
 const run=engine();run(`buyFighter(p,'ent',6,7);globalThis.ally=p.fighters[1];e.x=f.x+20;e.y=f.y;e.cd=10;e.speed=0;
 enemyAct(p,e,.01);globalThis.locked=e.brain.targetId;ally.x=e.x+1;ally.y=e.y;enemyAct(p,e,.2);`);
 assert.equal(run('e.brain.targetId'),run('locked'));
 run('recordCombatThreat(e,ally,100);enemyAct(p,e,.5)');assert.equal(run('e.brain.targetId'),run('ally.entityId'));
 run('healingThreat(p,f,ally,200)');assert.ok(run('e.brain.threat[f.entityId].value>0'));assert.ok(run('e.brain.threat[f.entityId].value<=15'));
 assert.doesNotThrow(()=>JSON.parse(run('JSON.stringify(G)')));
});

test('leaked creeps can retaliate against guards on the king road instead of ignoring them',()=>{
 const run=engine();run(`leak(p,e);const k=G.kings[p.team];f.x=k.x;f.y=k.y-40;e.x=k.x+5;e.y=k.y-45;e.cd=0;
 globalThis.kingHP=k.hp;globalThis.guardHP=f.hp;kingStep(k,.1);`);
 assert.ok(run('f.hp<guardHP'));assert.equal(run('G.kings[p.team].hp'),run('kingHP'));
});

test('stuns and death cancel attack windups before a projectile can fire',()=>{
 const run=engine('infantry');run("e.x=f.x+70;fighterAct(p,f,.01);add341Status(f,'stun',{time:1,stun:true});tick341(p,.1);fighterAct(p,f,.1)");
 assert.equal(run('f.brain.windup'),null);assert.equal(run('G.projectiles.length'),0);
 run('f.stunT=0;f.cd=0;fighterAct(p,f,.01);hitFighter(p,f,100000,"混乱",e)');
 assert.equal(run('f.brain.windup'),null);assert.equal(run('G.projectiles.length'),0);
});
