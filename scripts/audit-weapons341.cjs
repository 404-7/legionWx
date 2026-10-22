'use strict';
const fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(['source341','config','skills341','data'].map(n=>fs.readFileSync('js/'+n+'.js','utf8')).join('\n'),c);
const result=vm.runInContext(`({
 policy:'Original map overrides take precedence for damage, price and timing. Workbook values remain in sheetStats. Missing native defaults remain explicitly unverified.',
 units:[...SOURCE341.units,...SOURCE341.summons].map(row=>{
  const f=row.map.fields,u=UNITS[row.id],inherited=SOURCE341.rules.inherited[row.map.base]||{};
  return {id:row.id,name:row.english,rawId:row.fighterId,base:row.map.base,damage:{min:u.min,max:u.max,base:u.attackBase,dice:u.attackDice,sides:u.attackSides},
   sourceDamage:{base:f.ua1b??null,dice:f.ua1d??inherited.attackDice??null,sides:f.ua1s??inherited.attackSides??null},
   windup:u.attackPoint,windupSource:f.udp1!==undefined?'map':inherited.attackPoint!==undefined?'inherited-default':'web-fallback',
   projectileSpeed:u.projectileSpeed,projectileSource:f.ua1z!==undefined?'map':inherited.projectileSpeed!==undefined?'inherited-default':'web-fallback'};
 })})`,c);
fs.writeFileSync('data/legion341-weapons-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({units:result.units.length,windupFallbacks:result.units.filter(u=>u.windupSource==='web-fallback').map(u=>u.name),projectileFallbacks:result.units.filter(u=>u.projectileSource==='web-fallback').map(u=>u.name)},null,2));
