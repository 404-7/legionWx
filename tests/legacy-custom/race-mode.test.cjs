const {test}=require('node:test'),assert=require('node:assert/strict');
const createGame=require('../server/game.cjs'),fs=require('node:fs'),vm=require('node:vm');
const base=Array.from(vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../js/source341.js'),'utf8')+';SOURCE341.units.filter(r=>!r.elite&&!r.summonOnly).map(r=>({id:r.id,race:r.race,cost:r.baseCost}))'));

test('selected races lock purchases to each authenticated seat and preserve legal upgrades',()=>{
 const game=createGame([{slot:0,name:'Nature',race:'nature'},{slot:2,name:'Mech',race:'mech'}],{raceMode:'select'});
 assert.equal(game.snapshot().raceMode,'select');assert.equal(game.snapshot().players[0].race,'nature');
 assert.equal(game.action(0,{type:'buy',uid:'infantry',col:0,row:0,race:'mech',slot:2}),false);
 assert.equal(game.snapshot().players[0].gold,300);
 assert.equal(game.action(0,{type:'buy',uid:'ent',col:0,row:0}),true);
 assert.equal(game.action(0,{type:'upgrade',col:0,row:0,uid:'guardian'}),true);
 assert.equal(game.action(2,{type:'buy',uid:'infantry',col:0,row:0}),true);
 assert.equal(game.action(2,{type:'upgrade',col:0,row:0,uid:'zeus'}),true);
 assert.equal(game.action(0,{type:'buy',uid:'zeus',col:1,row:0}),false);
 assert.equal(game.action(0,{type:'race',race:'mech'}),false);
});

test('every race has legal deployable units, and random races persist across simulation snapshots',()=>{
 for(const race of createGame.raceKeys)assert.ok(base.some(d=>d.race===race&&d.cost<=300),race+' has an affordable base unit');
 for(let iteration=0;iteration<8;iteration++){
  const game=createGame([{slot:0,name:'A',race:'invalid'},{slot:2,name:'B',race:'invalid'}],{raceMode:'random'}),initial=game.snapshot();
  for(const slot of [0,2]){
   const own=initial.players[slot].race;assert.ok(createGame.raceKeys.includes(own));
   const good=base.find(d=>d.race===own&&d.cost<=300),bad=base.find(d=>d.race!==own&&d.cost<=300);
   assert.ok(good);assert.equal(game.action(slot,{type:'buy',uid:bad.id,col:0,row:0}),false);
   assert.equal(game.action(slot,{type:'buy',uid:good.id,col:0,row:0}),true);
  }
  game.step(2);const after=game.snapshot();assert.deepEqual(after.players.map(p=>p.race),initial.players.map(p=>p.race));
  assert.equal(after.players.every(p=>p.fighters.every(f=>f.def.race===p.race)),true,'AI and human defenders use only the assigned race');
 }
 assert.equal(createGame.raceKeys.length,14);
});

test('selected mode requires valid choices, allows mirrors and fills an empty former host seat with AI',()=>{
 assert.throws(()=>createGame([{slot:0,name:'A'}],{raceMode:'select'}));
 assert.throws(()=>createGame([{slot:0,race:'__proto__'}],{raceMode:'select'}));
 assert.throws(()=>createGame([],{raceMode:'invalid'}));
 const game=createGame([{slot:1,name:'A',race:'beast'},{slot:2,name:'B',race:'beast'}],{raceMode:'select'});
 const before=game.snapshot();assert.equal(before.players[1].race,before.players[2].race);
 assert.equal(before.players[0].isHuman,false);game.step(2);
 assert.equal(game.snapshot().players[0].fighters.length>0,true);
 assert.equal(game.snapshot().players.every(p=>p.fighters.every(f=>f.def.race===p.race)),true);
});
