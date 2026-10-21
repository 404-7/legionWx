const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function engine(extra={}) {
  const ctx=vm.createContext(extra);
  const run=code=>vm.runInContext(code,ctx);
  run(['config','data','engine','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));
  run("newGame('normal');G.players.forEach(p=>p.ai=null)");
  return {run,ctx};
}
test('six legions have four complete upgrade lines and valid combat stats',()=>{
  const {run}=engine();
  assert.equal(run('Object.keys(RACES).length'),6);
  assert.equal(run('Object.keys(UNITS).length'),48);
  assert.equal(run(`Object.keys(RACES).every(r=>{
    const units=Object.values(UNITS).filter(d=>d.race===r&&!d.elite);
    return units.length===4 && new Set(units.map(d=>d.tier)).size===4 && units.some(d=>d.range<=45) && units.some(d=>d.range>45);
  })`),true);
  assert.equal(run(`Object.values(UNITS).every(d=>
    !('el' in d)&&RACES[d.race]&&d.model&&d.cost>0&&d.hp>0&&d.dmg>0&&d.aspd>0&&ATK_ARMOR[d.atk][d.armor]&&
    (d.elite || (UNITS[d.up]?.race===d.race && UNITS[d.up].cost>d.cost && UNITS[d.up].elite))
  )`),true);
  assert.equal(run('Object.entries(AI_DECKS).every(([race,deck])=>deck.length===4&&deck.every(id=>UNITS[id].race===race&&!UNITS[id].elite))'),true);
  for(const race of run('Object.keys(RACES)')) {
    run(`G.players[1].ai={deck:AI_DECKS['${race}']};G.players[1].gold=600;G.players[1].fighters=[];aiAct(G.players[1])`);
    assert.ok(run('G.players[1].fighters.length')>0);
    assert.equal(run(`G.players[1].fighters.every(f=>f.def.race==='${race}')`),true);
  }
});
test('lifesteal uses actual post-armor damage and never heals from overkill',()=>{
  const {run}=engine();
  run(`buyFighter(G.players[0],'ghoul',2,2);const p=G.players[0],f=p.fighters[0];f.hp=200;f.cd=0;
    p.enemies=[{hp:10,x:f.x,y:f.y+10,r:10,armor:'无甲',magicImmune:false}];fighterAct(p,f,.05)`);
  assert.equal(run('G.players[0].fighters[0].hp'),201.5);
  assert.equal(run('G.players[0].fighters[0].def.abil.lifesteal'),.15);
});
test('healing auras use the strongest source, respect range, cap HP and do not resurrect',()=>{
  const {run}=engine();
  run(`const p=G.players[0];p.gold=3000;
    buyFighter(p,'orc_warrior',2,2);buyFighter(p,'witch_doctor',2,3);buyFighter(p,'elder_doctor',3,2);
    p.fighters[0].hp=200;fieldStep(p,1)`);
  assert.equal(run('G.players[0].fighters[0].hp'),212);
  run('p.fighters[0].x=0;p.fighters[0].y=0;fieldStep(p,1)');
  assert.equal(run('p.fighters[0].hp'),212);
  run('p.fighters[0].x=p.fighters[1].x;p.fighters[0].y=p.fighters[1].y;p.fighters[0].hp=p.fighters[0].max-1;fieldStep(p,1)');
  assert.equal(run('p.fighters[0].hp'),590);
  run('p.fighters[0].hp=0;fieldStep(p,1)');
  assert.equal(run("p.fighters.some(f=>f.uid==='orc_warrior')"),false);
});
test('regeneration is active and every unit has a drawable native sprite',()=>{
  // Fake drawing context catches missing model registrations and invalid helper calls without browser dependencies.
  const drawing=new Proxy({}, {get:(obj,key)=>obj[key]??(key.startsWith('create')?()=>({addColorStop(){}}):()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});
  const document={createElement:()=>({getContext:()=>drawing})};
  const {run}=engine({document});
  run("G.players[0].gold=1000;buyFighter(G.players[0],'sprite',2,2);G.players[0].fighters[0].hp=100;fieldStep(G.players[0],1)");
  assert.equal(run('G.players[0].fighters[0].hp'),102.3);
  run(fs.readFileSync(path.join(__dirname,'../js/sprites.js'),'utf8'));
  assert.doesNotThrow(()=>run('buildSprites()'));
  assert.equal(run('Object.keys(UNITS).every(id=>SPR[id])'),true);
});
