'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['source341', 'config', 'skills341', 'data', 'behavior','engine','combat341','ai'].map(name =>
  fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const raceKeys=Object.freeze(Array.from(vm.runInNewContext(source+';Object.keys(RACES)')));

module.exports = function createGame(humans,{raceMode='ap'}={}) {
  if(!['ap'].includes(raceMode))throw new Error('无效种族模式');

  const ctx = vm.createContext({});
  vm.runInContext(source + `
    globalThis.game = {
      init(humans,raceMode) {
        newGame('normal'); G.online = true;G.raceMode=raceMode;
        // Vacant Warcraft slots stay vacant; only actual participants spawn waves.
        G.diff.allyMult = G.diff.aiMult = 1;
        G.players.forEach(p => {p.gold = 0;p.wood=0;p.isHuman=false;p.active=false;p.ai=null;});
        for (const h of humans) {
          const p = G.players[h.slot]; p.isHuman = true;p.active=true;p.gold=CFG.START_GOLD;p.wood=SOURCE341.rules.native.startWood;p.name=h.name;
        }
        G.players.forEach(p=>{p.race=null;if(!p.active)p.name='空席 '+(p.id+1);});
      },
      step(dt) { if (G.phase !== 'over') simStep(dt); },
      forfeit(team) { if (G.phase !== 'over') { addLog('玩家离线超时，判定弃权', 'l-red'); gameOver(1 - team); } },
      leaveSlot(slot){if(G.phase!=='over')leavePlayer341(slot);},
      action(slot, a) {
        if (!a || !['prep','combat'].includes(G.phase)) return false;
        const p = G.players[slot];
        if (!p || !p.isHuman) return false;
        const f = p.towers.find(f => f.col === a.col && f.row === a.row);
        switch (a.type) {
          case 'chooseBuilder': return chooseBuilder341(p,a.race);
          case 'changeBuilder': return changeBuilder341(p);
          case 'rerollProphet': return rerollProphet341(p);
          case 'buy': return Object.hasOwn(UNITS, a.uid) && Number.isInteger(a.col) && Number.isInteger(a.row) && p.fighters.filter(f=>!f.temporary).length < CFG.COLS*CFG.ROWS && buyFighter(p, a.uid, a.col, a.row);
          case 'upgrade': return !!f && upgradeFighter(p, f, a.uid);
          case 'sell': return !!f && sellFighter(p, f);
          case 'steroids': return !!f && inject341Steroids(p,f);
          case 'king': return kingUpgrade(p, a.stat);
          case 'claimKing': return claimKing341(p);
          case 'royalHeal': return royalHeal341(p);
          case 'kingCommand': return kingCommand341(p,a);
          case 'farmUpgrade': return farmUpgrade341(p);
          case 'cancelFarm': return cancelFarm341(p);
          case 'cancelConstruction': return !!f&&cancelConstruction341(p,f);
          case 'worker': return buyWorker341(p);
          case 'lumberResearch': return researchLumber341(p);
          case 'merc': return Object.hasOwn(MERCS,a.mid)&&sendMerc(p,null,a.mid);
          default: return false;
        }
      },
      snapshot(viewerSlot) {
        const state=JSON.parse(JSON.stringify(G, (key, value) => {
          if(key==='def'&&viewerSlot!==undefined)return value.id;
          if (['selectedFighter','selectedShop','hover','ai','diff'].includes(key)) return undefined;
          if (key === 'projectiles') return value.map(pr => ({ x:pr.x, y:pr.y, px:pr.px, py:pr.py, atk:pr.atk }));
          if (key === 'skillWaves') return value.map(w=>({x:w.x,y:w.y,px:w.px,py:w.py,radius:w.radius,kind:w.kind}));
          return value;
        }));
        return viewerSlot===undefined?state:scopeBattleSnapshot(state,viewerSlot);
      }
    };
  `, ctx);
  ctx.game.init(humans,raceMode);
  return ctx.game;
};
module.exports.raceKeys=raceKeys;
