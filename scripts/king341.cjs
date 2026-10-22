'use strict';
module.exports=function king341(units,abilities,upgrades){
 const f=units.h00K.fields,round=n=>Math.round(n*10000)/10000;
 const a=id=>abilities[id].fields,q=id=>upgrades.find(o=>o.id===id).fields;
 const skill=(id,name,wave,extra)=>({id,name,wave,description:a(id)['aub1:1:0'],sourceFields:a(id),...extra});
 return {id:'h00K',sourceFields:f,hp:f.uhpm,regen:f.uhpr,min:f.ua1b+f.ua1d,max:f.ua1b+f.ua1d*f.ua1s,
  interval:round(f.ua1c),windup:f.udp1,range:f.ua1r*.25,rawRange:f.ua1r,projectileSpeed:f.ua1z*.25,
  mana:f.umpm,manaRegen:f.umpr,armorPoints:f.udef??0,attack:'英雄',armor:'英雄甲',
  // Unmodified Warcraft base object values are absent from w3u/w3q overrides.
  inheritedDefaults:{'hwtw.udef':0,'Rhla.gba1':2,'Rhla.gmo1':2,'AItn.Iatt':10},
  upgrades:{
   health:{limit:q('R000')['glvl:0:0'],cost:units.u008.fields.ulum,income:3,
    amounts:Array.from({length:20},(_,i)=>-a('A05P')[`Ilif:${i+2}:1`])},
   attack:{limit:q('R001')['glvl:0:0'],cost:units.u009.fields.ulum,income:3,amount:10},
   regen:{limit:q('R002')['glvl:0:0'],cost:units.u00A.fields.ulum,income:3,amount:q('R002')['gba1:0:0']}
  },auto:{every:4,levels:2,armorPerLevel:2,hastePerLevel:round(q('R007')['gba1:0:0']),limit:30},
  skills:[
   skill('A022','战争践踏',4,{radius:a('A022')['aare:1:0']*.25,damage:a('A022')['Wrs1:1:1'],stun:a('A022')['adur:1:0'],mana:a('A022')['amcs:1:0'],cd:a('A022')['acdn:1:0']}),
   skill('A01T','永久献祭',4,{radius:a('A01T')['aare:1:0']*.25,dps:a('A01T')['Eim1:1:1']}),
   skill('A021','震荡波',4,{radius:a('A021')['aare:1:0']*.25,length:a('A021')['Osh3:1:3']*.25,damage:a('A021')['Osh1:1:1'],mana:a('A021')['amcs:1:0'],cd:a('A021')['acdn:1:0']}),
   skill('A01W','命令光环',13,{radius:350,damage:round(a('A01W')['Cac1:1:1'])}),
   skill('A01U','专注光环',19,{radius:350,armor:a('A01U')['Had1:1:1']}),
   skill('S001','耐久光环',23,{radius:350,move:round(a('S001')['Oae1:1:1']),haste:round(a('S001')['Oae2:1:2'])})
  ],upgradeSource:upgrades.filter(o=>['R000','R001','R002','R006','R007'].includes(o.id))};
};
