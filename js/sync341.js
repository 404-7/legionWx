(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Sync341=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const own=(o,k)=>Object.hasOwn(o,k),safe=k=>!['__proto__','prototype','constructor'].includes(k);
 const unitFields='entityId uid def ownerId team col row x y hp max mana deadT flash r moving facing spent newlyBuilt temporary steroids pendingBattle constructionRemaining constructionGold constructionWood upgradePending hybridTier slowF effMove mercId trait boss magicImmune slowT air range toKing'.split(' ');
 function rounded(value){if(typeof value==='number')return Number.isFinite(value)?Math.round(value*100)/100||0:null;if(Array.isArray(value))return value.map(rounded);if(value&&typeof value==='object'){const out={};for(const k of Object.keys(value))if(safe(k)&&value[k]!==undefined)out[k]=rounded(value[k]);return out;}return value;}
 function unit(value){const out={};for(const k of unitFields)if(own(value,k))out[k]=value[k];if(value.brain)out.brain={state:value.brain.state};return out;}
 function project(state){
  if(!state)return null;const out={...state};for(const k of ['entitySerial','kingClock','kingGoldPools','selectedMine','selectedShop','selectedFighter','hover'])delete out[k];
  out.players=state.players.map(p=>{const q={...p,towers:p.towers.map(unit),fighters:p.fighters.map(unit),enemies:p.enemies.map(unit)};for(const k of ['spawnT','spawnIv','mercSpawnT','workerHarvest','lumberElapsed','aiT','totalLeaks','leakGoldFactor'])delete q[k];for(const k of ['spawnList','mercSpawnList'])q[k]=(q[k]||[]).map(()=>null);return q;});
  out.kings=state.kings.map(k=>{const q={...k,leaks:k.leaks.map(unit)};for(const key of ['windup','growthWave'])delete q[key];return q;});return rounded(out);
 }
 function keyField(a){if(!a.length||!a.every(v=>v&&typeof v==='object'&&!Array.isArray(v)))return null;for(const key of ['entityId','id','team'])if(a.every(v=>own(v,key))&&new Set(a.map(v=>String(v[key]))).size===a.length)return key;return null;}
 function delta(before,after){
  if(before===after)return undefined;
  if(before===null||after===null||typeof before!=='object'||typeof after!=='object'||Array.isArray(before)!==Array.isArray(after))return [0,after];
  if(Array.isArray(after)){
   const field=keyField(after)||keyField(before);
   if(field&&[before,after].every(a=>a.every(v=>v&&own(v,field)))){
    const old=new Map(before.map(v=>[String(v[field]),v])),changes={},order=after.map(v=>String(v[field]));let changed=false;
    for(const value of after){const key=String(value[field]),d=delta(old.get(key),value);if(d!==undefined){changes[key]=d;changed=true;}}
    const reordered=before.length!==after.length||before.some((v,i)=>String(v[field])!==order[i]);
    return changed||reordered?[2,field,reordered?order:null,changes]:undefined;
   }
   const changes={};for(let i=0;i<after.length;i++){const d=delta(before[i],after[i]);if(d!==undefined)changes[i]=d;}
   return before.length!==after.length||Object.keys(changes).length?[3,after.length,changes]:undefined;
  }
  const changes={},removed=Object.keys(before).filter(k=>!own(after,k));for(const k of Object.keys(after))if(safe(k)){const d=delta(before[k],after[k]);if(d!==undefined)changes[k]=d;}
  return removed.length||Object.keys(changes).length?[1,changes,removed]:undefined;
 }
 function apply(before,patch){
  if(!patch)return before;if(patch[0]===0)return patch[1];
  if(patch[0]===1){const out={...before};for(const k of patch[2])delete out[k];for(const k of Object.keys(patch[1]))if(safe(k))out[k]=apply(before?.[k],patch[1][k]);return out;}
  if(patch[0]===2){const field=patch[1],old=new Map((before||[]).map(v=>[String(v[field]),v])),order=patch[2]||(before||[]).map(v=>String(v[field]));return order.map(key=>apply(old.get(key),patch[3][key]));}
  if(patch[0]===3){const out=(before||[]).slice(0,patch[1]);out.length=patch[1];for(const k of Object.keys(patch[2]))out[k]=apply(before?.[k],patch[2][k]);return out;}
  throw Error('Unknown synchronization patch');
 }
 function encoder(){return {seq:0,value:null,next(value){const base=this.seq++;const patch=base?delta(this.value,value):undefined;this.value=value;return !base||this.seq%100===0?this.full():{v:1,seq:this.seq,base,delta:patch||null};},full(){return {v:1,seq:this.seq,full:this.value};}};}
 function decode(previous,frame){if(frame.v!==1)throw Error('Unsupported synchronization version');if(own(frame,'full'))return {seq:frame.seq,value:frame.full};if(!previous||previous.seq!==frame.base||frame.seq!==frame.base+1)throw Error('Synchronization sequence mismatch');return {seq:frame.seq,value:apply(previous.value,frame.delta)};}
 return {project,delta,apply,encoder,decode};
});
