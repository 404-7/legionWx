const {test}=require('node:test'),assert=require('node:assert/strict'),Sync=require('../js/sync341.js'),engine=require('./helpers/native-engine.cjs');
test('delta frames reconstruct nested updates, deletions, nulls, reordered entities and changing arrays without mutating the baseline',()=>{
 let value={room:{waiting:false},state:{players:[{id:0,gold:300,fighters:[{entityId:1,hp:10},{entityId:2,hp:20}]}],effects:[1,2,3],phase:'prep'}};const enc=Sync.encoder();let decoded=Sync.decode(null,enc.next(value));
 for(let i=0;i<250;i++){const previous=JSON.stringify(decoded.value);value=structuredClone(value);value.room.waiting=i%3===0;value.state.players[0].gold=i;value.state.players[0].fighters=i%2?[{entityId:2,hp:i},{entityId:i+1000,hp:5}]:[{entityId:1,hp:i}];value.state.effects=Array.from({length:i%7},(_,j)=>j+i);if(i%2)delete value.state.phase;else value.state.phase=null;const frame=enc.next(value),next=Sync.decode(decoded,JSON.parse(JSON.stringify(frame)));assert.deepEqual(next.value,value);assert.equal(JSON.stringify(decoded.value),previous);decoded=next;}
});
test('missing or reordered deltas are rejected, and a full checkpoint recovers without a previous state',()=>{
 const enc=Sync.encoder(),first=enc.next({state:1});enc.next({state:2});const third=enc.next({state:3});assert.throws(()=>Sync.decode(Sync.decode(null,first),third),/sequence/);assert.deepEqual(Sync.decode(null,enc.full()).value,{state:3});
});
test('projected live combat states round trip through every delta and contain display data rather than targeting internals',()=>{
 const run=engine();run("for(const p of G.players){p.gold=10000;chooseBuilder341(p,'nature');buyReady341(p,'ent',0,8);}startCombat()");const enc=Sync.encoder();let decoded=null,totalDelta=0,totalFull=0;
 for(let i=0;i<150;i++){run('simStep(.1)');const raw=JSON.parse(run('JSON.stringify(scopeBattleSnapshot(JSON.parse(JSON.stringify(G,(k,v)=>k==="def"?v.id:v)),0))')),projected=Sync.project(raw),value={room:{code:'TEST'},state:projected},frame=enc.next(value);decoded=Sync.decode(decoded,JSON.parse(JSON.stringify(frame)));assert.deepEqual(decoded.value,value);totalDelta+=Buffer.byteLength(JSON.stringify(frame));totalFull+=Buffer.byteLength(JSON.stringify(value));assert.equal(projected.players[0].fighters[0]?.brain?.targetId,undefined);assert.equal(projected.players[4].wood,null);}
 assert.ok(totalDelta<totalFull*.5,`delta ${totalDelta}, full ${totalFull}`);
});
