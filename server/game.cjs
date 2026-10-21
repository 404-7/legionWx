'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = ['source341', 'config', 'skills341', 'data', 'behavior','engine','combat341','ai'].map(name =>
  fs.readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');

module.exports = function createGame(humans) {
  const ctx = vm.createContext({});
  vm.runInContext(source + `
    globalThis.game = {
      init(humans) {
        newGame('normal'); G.online = true;
        // All online seats receive the same economy, including AI substitutes.
        G.diff.allyMult = G.diff.aiMult = 1;
        G.players.forEach(p => p.gold = CFG.START_GOLD);
        for (const h of humans) {
          const p = G.players[h.slot]; p.isHuman = true; p.ai = null; p.name = h.name;
        }
        G.players.forEach(p => { if (!p.isHuman) p.name = 'AI · ' + p.name; });
      },
      step(dt) { if (G.phase !== 'over') simStep(dt); },
      forfeit(team) { if (G.phase !== 'over') { addLog('玩家离线超时，判定弃权', 'l-red'); gameOver(1 - team); } },
      action(slot, a) {
        if (!a || !['prep','combat'].includes(G.phase)) return false;
        const p = G.players[slot];
        if (!p || !p.isHuman) return false;
        const f = p.fighters.find(f => !f.temporary && f.col === a.col && f.row === a.row);
        switch (a.type) {
          case 'buy': return Object.hasOwn(UNITS, a.uid) && Number.isInteger(a.col) && Number.isInteger(a.row) && p.fighters.filter(f=>!f.temporary).length < CFG.COLS*CFG.ROWS && buyFighter(p, a.uid, a.col, a.row);
          case 'upgrade': return !!f && upgradeFighter(p, f, a.uid);
          case 'sell': return !!f && sellFighter(p, f);
          case 'steroids': return !!f && inject341Steroids(p,f);
          case 'king': return kingUpgrade(p, a.stat);
          case 'mineBuy': return buyMine(p);
          case 'mineUpgrade': return upgradeMine(p, a.id);
          case 'merc': { const target = Number.isInteger(a.target) && G.players[a.target]; return Object.hasOwn(MERCS, a.mid) && !!target && target.mercQueue.length < 40 && sendMerc(p, target, a.mid); }
          default: return false;
        }
      },
      snapshot() {
        return JSON.parse(JSON.stringify(G, (key, value) => {
          if (['selectedFighter','selectedShop','hover','ai','diff'].includes(key)) return undefined;
          if (key === 'projectiles') return value.map(pr => ({ x:pr.x, y:pr.y, px:pr.px, py:pr.py, atk:pr.atk }));
          return value;
        }));
      }
    };
  `, ctx);
  ctx.game.init(humans);
  return ctx.game;
};
