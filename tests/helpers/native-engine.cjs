const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const fixtures='\nfunction buyReady341(p,...args){const ok=buyFighter(p,...args);if(ok)stepConstruction341(p,60);return ok;}\nfunction upgradeReady341(p,...args){const ok=upgradeFighter(p,...args);if(ok)stepConstruction341(p,60);return ok;}\n';
module.exports=function engine(){const ctx=vm.createContext({}),run=s=>vm.runInContext(s,ctx);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../../js',n+'.js'),'utf8')).join('\n')+fixtures);run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.active=true;p.race=null});globalThis.p=G.players[0];globalThis.k=G.kings[0]");return run;};
module.exports.fixtureSource=fixtures;
