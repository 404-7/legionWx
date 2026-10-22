'use strict';
// Source coordinates and explicit economic overrides; never execute JASS.
module.exports=function native341({units,abilities,upgrades,jass}){
 const rects={};for(const m of jass.matchAll(/set gg_rct_(\w+) = Rect\(([^)]+)\)/g))rects[m[1]]=m[2].split(',').map(n=>Number(n.replace(/\s/g,'')));
 const q=id=>upgrades.find(o=>o.id===id).fields;
 return {slots:8,teamSize:4,defaultModes:['ap','hg','gg','mm','cb','x3'],startGold:300,startWood:97,startIncome:0,sellPercent:.5,
  map:{scale:.25,minX:-7040,maxY:7296,width:3520,height:3072,rects,
   towns:[...jass.matchAll(/CreateUnit\(p , 'h023' , ([^,]+), ([^,]+),/g)].map(m=>[Number(m[1].replace(/\s/g,'')),Number(m[2].replace(/\s/g,''))]),
   kings:[...jass.matchAll(/CreateUnit\(p , 'h00K' , ([^,]+), ([^,]+),/g)].map(m=>[Number(m[1].replace(/\s/g,'')),Number(m[2].replace(/\s/g,''))])},
  workers:{unit:'e003',gold:units.e003.fields.ugol,time:units.e003.fields.ubld,limit:7,initial:1,requireValue:350,cycle:abilities.A09C.fields['adur:1:0'],amount:abilities.A09C.fields['Wha2:1:2'],
   upgrades:['R003','R00H'].flatMap(id=>{const f=q(id);return Array.from({length:f['glvl:0:0']},(_,i)=>({id,gold:f['gglb:0:0']+i*(f['gglm:0:0']||0),wood:(f['glmb:0:0']||0)+i*(f['glmm:0:0']||0),time:f['gtib:0:0']+i*(f['gtim:0:0']||0),amount:f['gba1:0:0']}));})},
  changeBuilder:{limit:q('R00D')['glvl:0:0'],gold:q('R00D')['gglb:0:0'],goldStep:q('R00D')['gglm:0:0']??50,wood:q('R00D')['glmb:0:0']??50,woodStep:q('R00D')['glmm:0:0'],sourceFields:q('R00D'),inheritedDefaults:{'Rhla.gglm':50,'Rhla.glmb':50}},
  prophetReroll:{limit:q('R00G')['glvl:0:0'],gold:q('R00G')['gglb:0:0'],goldStep:q('R00G')['gglm:0:0']??50,wood:q('R00G')['glmb:0:0'],woodStep:q('R00G')['glmm:0:0'],sourceFields:q('R00G')},
  royalHeal:{id:'A084',amount:abilities.A084.fields['Hhb1:1:1'],uses:1,sourceFields:abilities.A084.fields},
  unitPools:Array.from({length:6},(_,i)=>[...jass.matchAll(new RegExp("set udg_UnitSet"+(i+1)+"\\[udg_Temp_Integer\\]='(.{4})'",'g'))].map(m=>m[1])),
  hybrid:['h07D','h07E','h07G','h07F','h07H','h07I'].map(id=>({id,cost:units[id].fields.ugol,time:units[id].fields.ubld+.3})),
  sourcePolicy:'Map overrides take precedence over the spreadsheet; absent native base fields remain tracked defaults.'};
};
