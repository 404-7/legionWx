const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function engine(){const ctx=vm.createContext({}),run=code=>vm.runInContext(code,ctx);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=100000;});globalThis.p=G.players[0];globalThis.k=G.kings[0];");return run;}
function leaks(run){run("G.phase='combat';spawnEnemy(p,{type:'wave'});spawnEnemy(p,{type:'wave'});for(const e of [...p.enemies]){leak(p,e);e.x=k.x+70;e.y=k.y;e.speed=0;e.hp=e.max=10000;e.cd=100;e.routeIndex=e.route.length-1;}globalThis.e=k.leaks[0];globalThis.other=k.leaks[1];");}

test('source king uses map base stats and bounded fixed-cost team upgrades',()=>{
 const run=engine();assert.deepEqual(JSON.parse(run('JSON.stringify([k.hp,k.regen,k.min,k.maxDamage,k.aspd,CFG.KING_RANGE,k.mana])')),[2600,3,31,41,.9,178.75,1000]);
 run("kingUpgrade(p,'health');kingUpgrade(p,'health')");assert.equal(run('k.max'),3525);assert.equal(run('p.gold'),99840);assert.equal(run('p.income'),12);
 run("while(kingUpgrade(p,'health')){};while(kingUpgrade(p,'attack')){};while(kingUpgrade(p,'regen')){}");
 assert.equal(run('k.max'),16350);assert.equal(run('k.min'),331);assert.equal(run('k.maxDamage'),341);assert.equal(run('k.regen'),103);
 for(const stat of ['health','attack','regen']){assert.equal(run(`kingUpgradeCost(k,'${stat}')`),Infinity);const gold=run('p.gold');assert.equal(run(`kingUpgrade(p,'${stat}')`),false);assert.equal(run('p.gold'),gold);}
});
test('king fires a delayed single-target hero missile without free splash and cancels invalid windups',()=>{
 const run=engine();leaks(run);run('e.armorPoints=0;kingStep(k,.05)');assert.equal(run('G.projectiles.length'),0);assert.equal(run('e.hp'),10000);
 run('for(let i=0;i<10;i++)kingStep(k,.05)');assert.equal(run('G.projectiles.length'),1);assert.equal(run('G.projectiles[0].atk'),'英雄');
 run('projStep(G.projectiles[0],1)');assert.ok(run('10000-e.hp')>=31&&run('10000-e.hp')<=41);assert.equal(run('other.hp'),10000);
 run('k.cd=0;k.windup=null;G.projectiles=[];kingStep(k,.01);e.hp=0;other.hp=0;kingStep(k,1)');assert.equal(run('G.projectiles.length'),0);assert.equal(run('k.windup'),null);
});
test('hero armor and automatic four-wave growth reduce incoming damage and shorten attack intervals once',()=>{
 const run=engine();leaks(run);run('e.x=k.x;e.range=30;e.attackBase=100;e.attackDice=0;e.atk="穿刺";e.cd=0;k.cd=100;kingStep(k,.01)');assert.equal(run('k.hp'),2600);run('kingStep(k,e.attackPoint+.01)');assert.equal(run('k.hp'),2500);
 run('growKing341(k,4)');assert.equal(run('k.armorPoints'),4);assert.ok(Math.abs(run('kingInterval341(k)')-.9/1.1)<1e-8);assert.equal(run('k.skills.length'),1);
 const skill=run('k.skills[0]');run('growKing341(k,4)');assert.equal(run('k.skills[0]'),skill);assert.equal(run('k.skills.length'),1);
 run('k.hp=2600;k.skills=[];e.cd=0;kingStep(k,.01);kingStep(k,e.attackPoint+.01)');assert.ok(Math.abs(run('2600-k.hp')-100/1.24)<1e-8);
});
test('learned stomp respects mana, cooldown, stun and magic immunity; immolation hits only ground',()=>{
 const run=engine();leaks(run);run("k.skills=['A022'];e.x=k.x+35;other.x=k.x+45;other.magicImmune=true;kingSpell341(k,e)");
 assert.equal(run('e.hp'),9955);assert.equal(run('e.statuses.kingStomp.time'),1.25);assert.equal(run('other.hp'),10000);assert.equal(run('other.statuses?.kingStomp'),undefined);assert.equal(run('k.mana'),750);
 run('kingSpell341(k,e)');assert.equal(run('k.mana'),750);run("k.spellCD.A022=0;k.mana=249;kingSpell341(k,e)");assert.equal(run('e.hp'),9955);
 run("k.skills=['A01T'];e.air=false;other.magicImmune=false;other.air=true;k.cd=100;kingStep(k,1)");assert.equal(run('e.hp'),9943);assert.equal(run('other.hp'),10000);
});
test('shockwave follows a line and late-wave royal auras affect nearby guards and king, excluding PK',()=>{
 const run=engine();leaks(run);run("k.skills=['A021'];other.x=k.x-70;kingSpell341(k,e);stepSkillWaves341(1)");assert.equal(run('e.hp'),9910);assert.equal(run('other.hp'),10000);assert.equal(run('k.mana'),800);
 run("growKing341(k,13);growKing341(k,19);growKing341(k,23);buyFighter(p,'ent',5,7);globalThis.f=p.fighters[0];f.x=k.x+20;f.y=k.y;tick341({...p,enemies:[]},.01)");
 assert.equal(run('f.effDmg'),run('f.def.dmg*1.15'));assert.equal(run('f.effArmor'),run('f.def.armorPoints+5'));assert.equal(run('f.effHaste'),.1);assert.equal(run('kingAura341(0,k).move'),.15);
 run("G.battleMode='arena';tick341({...p,enemies:[]},.01)");assert.equal(run('f.effHaste'),0);assert.equal(run('f.effArmor'),run('f.def.armorPoints'));assert.equal(run('f.effDmg'),run('f.def.dmg'));
});
