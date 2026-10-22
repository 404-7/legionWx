const {test}=require('node:test'),assert=require('node:assert/strict'),{server,rooms}=require('../server/index.cjs');
test('real HTTP/SSE supports eight authenticated seats, source AP selection, hidden enemy resources, reconnect and correct-team forfeit',async t=>{
 await require('../scripts/test-server.cjs')(server);const base='http://127.0.0.1:'+server.address().port,controllers=[];
 t.after(async()=>{controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(r=>server.close(r));rooms.clear();});
 async function post(route,data={},seat){const r=await fetch(base+'/api/'+route+(seat?'?room='+seat.code:''),{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:'Bearer '+seat.token}:{})},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};}
 async function stream(seat){const c=new AbortController();controllers.push(c);const r=await fetch(base+'/api/events?'+new URLSearchParams({room:seat.code,token:seat.token}),{signal:c.signal});assert.equal(r.status,200);const reader=r.body.getReader();let buffer='';return {c,async next(predicate){for(let i=0;i<400;i++){const split=buffer.indexOf('\n\n');if(split>=0){const frame=buffer.slice(0,split);buffer=buffer.slice(split+2);if(frame.startsWith('data: ')){const data=JSON.parse(frame.slice(6));if(predicate(data))return data;}}else{const result=await reader.read();if(result.done)throw Error('SSE closed');buffer+=new TextDecoder().decode(result.value);}}throw Error('SSE predicate timeout');}};}
 const a=(await post('create',{name:'A',raceMode:'select'})).data,seats=[a];for(let i=1;i<8;i++)seats.push((await post('join',{name:'P'+i,code:a.code})).data);
 assert.deepEqual(seats.map(s=>s.slot),[0,4,1,5,2,6,3,7]);assert.equal((await post('join',{code:a.code})).status,400);
 const streams=[];for(const seat of seats)streams.push(await stream(seat));assert.equal((await post('start',{},seats[1])).status,403);assert.equal((await post('start',{},a)).status,200);
 assert.equal((await post('action',{type:'buy',uid:'ent',col:0,row:0},a)).status,400);
 assert.equal((await post('action',{type:'chooseBuilder',race:'nature'},a)).status,200);assert.equal((await post('action',{type:'chooseBuilder',race:'mech'},a)).status,400);
 assert.equal((await post('action',{type:'buy',uid:'ent',col:0,row:0,slot:4,gold:999999,wood:999999},a)).status,200);
 assert.equal((await post('action',{type:'farmUpgrade'},a)).status,200);assert.equal((await post('action',{type:'king',stat:'health'},a)).status,400);
 for(const type of ['mineBuy','mineUpgrade','worker'])assert.equal((await post('action',{type,id:0,wood:999999},a)).status,400);
 const va=await streams[0].next(v=>v.state?.players[0].farmLevel===1),vb=await streams[1].next(v=>v.state?.vision?.team===1);
 assert.equal(va.room.raceMode,'ap');assert.equal(va.state.players.length,8);assert.equal(va.state.players[0].wood,17);assert.equal(va.state.players[0].towers.length,1);assert.equal(va.state.players[4].race,null);
 assert.equal(va.state.players[0].towers[0].def,'ent');
 assert.equal(vb.state.players[0].wood,null);assert.equal(vb.state.players[0].towers.length,0);assert.equal(vb.state.players[0].fighters.length,0);
 assert.equal((await post('action',{type:'king'},{...a,token:'fake'})).status,401);
 streams[0].c.abort();const reconnected=await stream(a);assert.equal((await reconnected.next(v=>v.state?.players[0].towers.length===1)).state.players[0].farmLevel,1);
 assert.equal((await post('leave',{},seats[1])).status,200);const departed=await reconnected.next(v=>v.state?.players[4].active===false);assert.notEqual(departed.state.phase,'over');
 for(const seat of [seats[3],seats[5],seats[7]])assert.equal((await post('leave',{},seat)).status,200);const over=await reconnected.next(v=>v.state?.phase==='over');assert.equal(over.state.result.winner,0);
});
