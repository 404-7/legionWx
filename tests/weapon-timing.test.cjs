const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function engine(){const c=vm.createContext({}),run=s=>vm.runInContext(s,c);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(require('node:path').join(__dirname,'../js',n+'.js'),'utf8')).join('\n')+require('./helpers/native-engine.cjs').fixtureSource);run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.active=true;p.gold=10000;p.wood=100000});globalThis.p=G.players[0];p.race='nature';buyReady341(p,'ent',0,0);globalThis.f=p.fighters[0];spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.x=f.x+10;e.y=f.y;e.speed=0;f.hp=f.max=10000;f.effArmor=0;e.atk='混乱'");return run;}
test('two independent dice produce the triangular distribution rather than uniform min/max samples',()=>{
 const run=engine(),counts={};for(let a=0;a<3;a++)for(let b=0;b<3;b++){
  const n=run(`(()=>{const rolls=[${a}/3,${b}/3];return rollAttack341({attackBase:10,attackDice:2,attackSides:3},()=>rolls.shift())})()`);counts[n]=(counts[n]||0)+1;
 }assert.deepEqual(counts,{12:1,13:2,14:3,15:2,16:1});
 assert.equal(run('Object.values(UNITS).every(u=>u.attackBase+u.attackDice===u.min&&u.attackBase+u.attackDice*u.attackSides===u.max)'),true);
});
test('explicit object attack points and individual projectile speeds survive import for every fighter and wave',()=>{
 const run=engine();assert.equal(run('SOURCE341.units.every(r=>(r.map.fields.udp1===undefined||UNITS[r.id].attackPoint===r.map.fields.udp1)&&(r.map.fields.ua1z===undefined||UNITS[r.id].projectileSpeed===r.map.fields.ua1z*.25))'),true);
 assert.equal(run('SOURCE341.waves.every((w,i)=>(w.map.udp1===undefined||WAVES[i].attackPoint===w.map.udp1)&&(w.map.ua1z===undefined||WAVES[i].projectileSpeed===w.map.ua1z*.25))'),true);
});
test('creep windup delays damage, stun cancels it, and ranged damage waits for the travelling missile',()=>{
 const run=engine();run("e.weapon='normal';e.attackPoint=.4;e.cd=0;enemyAct(p,e,.01);enemyAct(p,e,.39)");assert.equal(run('f.hp'),10000);
 run('enemyAct(p,e,.01)');assert.ok(run('f.hp')<10000);
 run('e.cd=0;enemyAct(p,e,.01);e.stunT=1;enemyAct(p,e,.5)');assert.equal(run('e.attackWindup'),null);
 run("e.stunT=0;e.cd=0;e.weapon='missile';e.projectileSpeed=50;e.range=200;e.x=f.x-100;globalThis.before=f.hp;enemyAct(p,e,.01);enemyAct(p,e,.4)");assert.equal(run('f.hp'),run('before'));assert.equal(run('G.projectiles.length'),1);
 run('stepProjectiles341(1)');assert.equal(run('f.hp'),run('before'));run('stepProjectiles341(1)');assert.ok(run('f.hp')<run('before'));
});
test('missiles continue after their source dies and cancel when their target dies; bounce missiles survive the update queue',()=>{
 const run=engine();run("e.weapon='missile';e.projectileSpeed=50;e.attackPoint=.1;e.cd=0;enemyAttack341(p,e,f,.01);enemyAttack341(p,e,f,.1);e.hp=0;stepProjectiles341(1)");assert.ok(run('f.hp')<10000);
 run('e.hp=100;e.cd=0;enemyAttack341(p,e,f,.01);enemyAttack341(p,e,f,.1);f.hp=0;stepProjectiles341(.01)');assert.equal(run('G.projectiles.length'),0);
 run("p.enemies=[];for(let i=0;i<3;i++){spawnEnemy(p,{type:'wave'});const t=p.enemies.at(-1);t.x=100+i*50;t.y=100;t.hp=t.max=1000;t.armor='无甲';t.armorPoints=0;}f.hp=100;f.def={...f.def,projectileSpeed:100};G.projectiles=[{p,source:f,x:100,y:100,px:100,py:100,tgt:p.enemies[0],sp:100,dmg:100,atk:'混乱',ab:{chain:{n:2,f:.5,r:60}},t:5}];stepProjectiles341(.01)");assert.equal(run('G.projectiles.length'),1);assert.equal(run('p.enemies[1].hp'),1000);
 run('stepProjectiles341(.5)');assert.equal(run('p.enemies[1].hp'),950);assert.equal(run('p.enemies[2].hp'),1000);assert.equal(run('G.projectiles.length'),1);
 run('stepProjectiles341(.5)');assert.equal(run('p.enemies[2].hp'),975);assert.equal(run('G.projectiles.length'),0);
});
test('source preparation timers vary by wave, with no automatic 180-second arena draw or 240-second forced leak',()=>{
 const run=engine();assert.equal(run('G.timer'),80);run('G.wave=1;startPrep()');assert.equal(run('G.timer'),41);run('G.wave=8;startPrep()');assert.equal(run('G.timer'),44);
 run("G.wave=10;startArenaPrep();startCombat();for(const p of G.players){if(!p.fighters.length)buyReady341(p,'ent',0,0);}G.arena.elapsed=181;G.arena.countdown=0;G.players[4].fighters=[{...G.players[0].fighters[0],ownerId:4,entityId:999,hp:100,arenaReady:false,route:[{x:0,y:0}],routeIndex:0}];arenaStep(.001)");assert.notEqual(run('G.arena.stage'),'result');
 const run2=engine();run2("G.phase='combat';G.combatT=241;p.spawnList=[];e.speed=0;e.hp=100000;G.players.forEach(p=>p.paid=false);simStep(.01)");assert.equal(run2('G.kings[0].leaks.length'),0);assert.equal(run2('p.enemies.includes(e)'),true);
});
