const fs=require('node:fs'),vm=require('node:vm');const c=vm.createContext({});
vm.runInContext(['source341','config','skills341','data','engine','combat341','ai'].map(n=>fs.readFileSync('js/'+n+'.js','utf8')).join('\n'),c);
const report=vm.runInContext(`JSON.stringify({version:SOURCE341.version,source:SOURCE341.source,sourceHash:SOURCE341.sourceHash,mapSource:SOURCE341.mapSource,
 note:'Object data and web combat adapters; not a Warcraft engine emulation. See docs/source341.md for rule differences and inherited-default approximations.',
 units:SOURCE341.units.map(r=>({id:r.id,name:r.english,row:r.row,buildingId:r.buildingId,fighterId:r.fighterId,upgrades:r.upgrades,
 sourceSkills:UNITS[r.id].abil.sources.map(id=>({id,base:ABILITIES341[id]?.base,name:skillValue(ABILITIES341[id]||{fields:{}},'anam','')})),
 adapters:Object.keys(UNITS[r.id].abil).filter(k=>!['sources','pending'].includes(k)),pending:UNITS[r.id].abil.pending}))},null,2)`,c);
fs.writeFileSync('data/legion341-audit.json',report+'\n');
const parsed=JSON.parse(report);console.log(JSON.stringify({records:parsed.units.length,unmapped:parsed.units.filter(u=>u.pending.length).map(u=>({id:u.id,pending:u.pending}))}));
