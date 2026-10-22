const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function engine(extra={}) {
 const ctx=vm.createContext(extra),run=code=>vm.runInContext(code,ctx);
 run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));
 run("newGame('normal');G.players.forEach(p=>p.ai=null)");return {run,ctx};
}
test('187 spreadsheet records retain source stats; 14 races have 84 legal base units',()=>{
 const {run}=engine();
 assert.equal(run('SOURCE341.units.length'),187);assert.equal(run('Object.keys(RACES).length'),14);
 assert.equal(run('SOURCE341.units.filter(r=>!r.elite&&!r.summonOnly).length'),84);
 const sheet=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/legion341-sheet.json'),'utf8'));
 for(const r of JSON.parse(run('JSON.stringify(SOURCE341.units)'))){
  const original=sheet.units.find(u=>u.row===r.row);
  for(const key of ['min','max','interval','dps'])assert.equal(r[key],original[key],r.english+' '+key);
  assert.equal(r.baseCost,original.cost===''?null:original.cost);assert.equal(r.cost,original.total===''?null:original.total);
  if(typeof original.hp==='number')assert.equal(r.hp,original.hp);
  if(typeof original.range==='number')assert.equal(r.rawRange,original.range);
 }
 assert.equal(run(`Object.values(UNITS).every(d=>RACES[d.race]&&d.hp>0&&d.min>=0&&d.max>=d.min&&d.aspd>0&&ATK_ARMOR[d.atk]?.[d.armor]>0)`),true);
 assert.equal(run('Object.values(AI_DECKS).every(deck=>deck.length===6&&deck.every(id=>!UNITS[id].elite&&!UNITS[id].summonOnly))'),true);
 for(const race of run('Object.keys(RACES)')){
  run(`G.players[1].ai={deck:AI_DECKS['${race}']};G.players[1].gold=1000;G.players[1].fighters=[];aiAct(G.players[1])`);
  assert.ok(run('G.players[1].fighters.length')>0,race);
 }
});
test('upgrade branches charge Cost, reject illegal purchases and preserve stance HP',()=>{
 const {run}=engine();run('const p=G.players[0];p.gold=2000;buyFighter(p,"infantry",2,2)');
 assert.equal(run('JSON.stringify([...UNITS.infantry.upgrades].sort())'),JSON.stringify(['pyro','zeus']));
 assert.equal(run('upgradeFighter(p,p.fighters[0],"hydra")'),false);assert.equal(run('upgradeFighter(p,p.fighters[0],"zeus")'),true);
 assert.equal(run('p.gold'),2000-run('UNITS.infantry.purchaseCost+UNITS.zeus.purchaseCost'));
 assert.equal(run('buyFighter(p,"zeus",0,0)'),false);assert.equal(run('buyFighter(p,"fiend",0,0)'),false);
 assert.equal(run('buyFighter(p,"small_land_mine",0,0)'),true);
 run('const mine=p.fighters.find(f=>f.uid==="small_land_mine");const gold=p.gold;upgradeFighter(p,mine,"medium_land_mine")');
 assert.equal(run('gold-p.gold'),70);
 run('buyFighter(p,"wanderer",1,1);const hero=p.fighters.find(f=>f.uid==="wanderer");upgradeFighter(p,hero);hero.hp=hero.max/2;const balance=p.gold;upgradeFighter(p,hero,hero.def.stances[0])');
 assert.equal(run('p.gold'),run('balance'));assert.equal(run('hero.hp/hero.max'),.5);
});
test('source lifesteal, healing and numeric armor work; built units revive next wave',()=>{
 const {run}=engine();assert.equal(run('UNITS.ghoul.abil.lifesteal'),undefined);
 assert.ok(Math.abs(run('UNITS.frenzy_ghoul.abil.lifesteal')-.15)<1e-6);assert.ok(Math.abs(run('UNITS.captain.abil.aura.p')-.07)<1e-6);
 run(`const p=G.players[0];p.gold=5000;buyFighter(p,'ghoul',2,2);upgradeFighter(p,p.fighters[0]);const f=p.fighters[0];f.hp=200;f.cd=0;
 p.enemies=[{hp:10,x:f.x,y:f.y+10,r:10,armor:'无甲',armorPoints:20,magicImmune:false}];fighterAct(p,f,.05);fighterAct(p,f,1)`);
 assert.ok(Math.abs(run('f.hp')-201.5)<1e-5);assert.equal(run('armorFactor(10)'),.625);
 run('p.enemies=[];buyFighter(p,"young_witch_doctor",2,3);buyFighter(p,"young_witch_doctor",3,2);upgradeFighter(p,p.fighters[2]);f.hp=200;tick341(p,1)');
 assert.ok(Math.abs(run('f.hp')-210-run('f.def.regenFlat'))<1e-5);
 run('f.hp=0;fieldStep(p,1)');assert.equal(run('f.hp'),0);assert.equal(run('p.fighters.includes(f)'),true);
 run('endWave()');assert.equal(run('f.hp'),run('f.max'));
});
test('kill bounty, wave bonus and 31 source waves do not pay twice',()=>{
 const {run}=engine();assert.equal(run('G.players[0].gold'),300);assert.equal(run('WAVES.length'),31);
 assert.equal(run('WAVES[0].count'),36);assert.equal(run('WAVES[9].count'),3);
 run('const p=G.players[0];startCombat();spawnEnemy(p,{type:"wave"});p.enemies[0].hp=0;fieldStep(p,0)');
 assert.equal(run('p.gold'),303);run('fieldStep(p,0)');assert.equal(run('p.gold'),303);
 run('endWave()');assert.equal(run('p.gold'),320);
 run('G.wave=31;G.waveDef=WAVES[30];G.kings[0].hp=G.kings[0].max;G.kings[1].hp=G.kings[1].max;endWave()');
 assert.equal(run('G.result'),null);assert.notEqual(run('G.phase'),'over');
});
test('summons, hydra splitting and regen remain finite',()=>{
 const {run}=engine();
 run('const p=G.players[0];p.gold=10000;buyFighter(p,"gateguard",2,2);const f=p.fighters[0];f.mana=f.def.manaMax;spawnEnemy(p,{type:"wave"});p.enemies[0].x=f.x;p.enemies[0].y=f.y+10;tick341(p,.1)');
 assert.ok(run('p.fighters.some(f=>f.temporary&&f.uid==="fiend")'));
 run('buyFighter(p,"sea_giant",1,1);const h=p.fighters.find(f=>f.uid==="sea_giant");upgradeFighter(p,h,"hydra");h.hp=0;fieldStep(p,.1)');
 assert.equal(run('p.fighters.filter(f=>f.temporary&&f.uid==="mini_hydra").length'),3);
 run('buyFighter(p,"sprite",0,0);const s=p.fighters.find(f=>f.uid==="sprite");s.hp=100;tick341(p,1)');
 assert.ok(Math.abs(run('s.hp')-100-run('s.def.regenFlat'))<1e-5);
 for(let i=0;i<100;i++)run('fieldStep(p,.1);G.projectiles=G.projectiles.filter(pr=>projStep(pr,.1))');
 assert.equal(run('p.fighters.every(f=>Number.isFinite(f.hp)&&Number.isFinite(f.mana))'),true);
});
test('all imported units and extra summons have drawable native sprites',()=>{
 const drawing=new Proxy({}, {get:(obj,key)=>obj[key]??(key.startsWith('create')?()=>({addColorStop(){}}):()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});
 const {run}=engine({document:{createElement:()=>({getContext:()=>drawing})}});
 run(fs.readFileSync(path.join(__dirname,'../js/sprites.js'),'utf8'));
 assert.doesNotThrow(()=>run('buildSprites()'));assert.equal(run('Object.keys(UNITS).every(id=>SPR[id])'),true);
 assert.equal(run('Object.keys(MERCS).every(id=>SPR["m_"+id])'),true);
});
test('every imported fighter can run its skills without NaN, deadlocks or unserializable state',()=>{
 const {run}=engine();
 assert.equal(run(`(()=>{
  for(const def of Object.values(UNITS)){
   newGame('normal');G.players.forEach(p=>p.ai=null);const p=G.players[0];
   const f={def,uid:def.id,col:2,row:2,x:p.gx+90,y:p.gy+90,hp:def.hp*.2,max:def.hp,cd:0,spent:def.cost||0,effDmg:def.dmg,deadT:0,flash:0};
   init341Fighter(f);f.mana=def.manaMax;p.fighters=[f];
   for(let i=0;i<6;i++){spawnEnemy(p,{type:'wave'});const e=p.enemies[i];e.x=f.x+10+i*4;e.y=f.y+20;e.hp=e.max=5000;}
   for(let i=0;i<200;i++){fieldStep(p,.1);G.projectiles=G.projectiles.filter(pr=>projStep(pr,.1));}
   for(const g of p.fighters)if(!Number.isFinite(g.hp)||!Number.isFinite(g.mana)||!Number.isFinite(g.cd))throw Error(def.id+' invalid fighter');
   for(const e of p.enemies)if(!Number.isFinite(e.hp)||!Number.isFinite(e.x)||!Number.isFinite(e.y))throw Error(def.id+' invalid enemy');
   JSON.stringify(G,(key,value)=>key==='projectiles'?[]:value);
  }return true;
 })()`),true);
});
test('slave trade, one-wave steroids and goblin drivers use original special rules',()=>{
 const {run}=engine();
 run('const p=G.players[0];p.gold=5000;buyFighter(p,"servant",1,1);buyFighter(p,"servant",2,1);upgradeFighter(p,p.fighters[1]);const gold=p.gold;endWave()');
 assert.equal(run('p.gold-gold'),11+6+5);
 run('buyFighter(p,"goblin_scientist",3,1);const f=p.fighters[2];upgradeFighter(p,f);upgradeFighter(p,f);');
 assert.equal(run('f.uid'),'mutant');assert.equal(run('inject341Steroids(p,f)'),true);
 assert.equal(run('inject341Steroids(p,f)'),false);run('startCombat()');
 assert.equal(run('f.max'),run('f.def.hp*1.2'));run('endWave()');
 assert.equal(run('f.max'),run('f.def.hp'));assert.equal(run('f.steroids'),false);
 run('buyFighter(p,"steamroller",4,1);const tank=p.fighters.find(f=>f.uid==="steamroller");tank.hp=0;fieldStep(p,.1)');
 assert.equal(run('p.fighters.some(f=>f.temporary&&f.def.rawId==="h0D5")'),true);
});
