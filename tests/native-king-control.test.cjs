const {test}=require('node:test'),assert=require('node:assert/strict'),engine=require('./helpers/native-engine.cjs');
test('source king selection grants one ally control; another ally waits for the native five-tick lock and old controller commands then fail',()=>{
 const run=engine();assert.equal(run('claimKing341(p)'),true);assert.equal(run('claimKing341(G.players[1])'),false);run('simStep(4.99)');assert.equal(run('k.controlLock'),1);assert.equal(run('claimKing341(G.players[1])'),false);run('simStep(.01)');assert.equal(run('claimKing341(G.players[1])'),true);assert.equal(run('kingCommand341(p,{order:"autocast",enabled:false})'),false);
});
test('manual attack cancels an old windup, selects only a real king-road target and refreshes the control lock',()=>{
 const run=engine();run("spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];leak(p,e);claimKing341(p);k.windup={targetId:1,time:.4}");assert.equal(run('kingCommand341(p,{order:"target",targetId:e.entityId})'),true);assert.equal(run('k.manualTarget'),run('e.entityId'));assert.equal(run('k.windup'),null);assert.equal(run('k.controlLock'),5);assert.equal(run('kingCommand341(p,{order:"target",targetId:99999})'),false);
});
test('autocast can be disabled while a controller manually casts a learned spell; mana, cooldown and team permissions remain authoritative',()=>{
 const run=engine();run("G.phase='combat';spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];leak(p,e);e.x=k.x+30;e.y=k.y;e.hp=e.max=10000;e.cd=100;k.skills=['A022'];claimKing341(p)");
 assert.equal(run('kingCommand341(p,{order:"autocast",enabled:false})'),true);run('kingStep(k,.01)');assert.equal(run('k.mana'),1000);assert.equal(run('e.hp'),10000);
 assert.equal(run('kingCommand341(G.players[4],{order:"spell",spell:"A022"})'),false);assert.equal(run('kingCommand341(p,{order:"spell",spell:"A022"})'),true);assert.equal(run('k.mana'),750);assert.equal(run('e.hp'),9955);assert.equal(run('kingCommand341(p,{order:"spell",spell:"A022"})'),false);
});
test('automatic shockwave retains the JASS self-point order, using current facing for the web wave; manual cast uses its actual target direction',()=>{
 const run=engine();run("k.skills=['A021'];k.facing=Math.PI/2;spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.x=k.x+100;e.y=k.y;kingSpell341(k,e)");assert.ok(Math.abs(run('G.skillWaves[0].ux'))<1e-8);assert.equal(run('G.skillWaves[0].uy'),1);
 run("G.skillWaves=[];k.spellCD.A021=0;kingSpell341(k,e,'A021')");assert.equal(run('G.skillWaves[0].ux'),1);assert.equal(run('G.skillWaves[0].uy'),0);
});
test('each builder has one 10000-HP holy light charge; full-health targets reject it and changing builder cannot refresh the charge',()=>{
 const run=engine();run("chooseBuilder341(p,'nature')");assert.equal(run('royalHeal341(p)'),false);run('k.hp=500;k.max=16000');assert.equal(run('royalHeal341(p)'),true);assert.equal(run('k.hp'),10500);assert.equal(run('royalHeal341(p)'),false);
 run('p.gold=p.wood=10000;changeBuilder341(p);chooseBuilder341(p,p.builderChoices[0]);k.hp=1');assert.equal(run('royalHeal341(p)'),false);assert.equal(run('p.royalHealUsed'),true);
});
