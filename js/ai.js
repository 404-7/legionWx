'use strict';
/* ===== AI：建兵、升级、强化国王、雇佣兵 ===== */

const AI_DECKS = Object.fromEntries(Object.keys(RACES).map(race=>[
  race,Object.keys(UNITS).filter(id=>UNITS[id].race===race&&!UNITS[id].elite&&!UNITS[id].summonOnly)
]));

function aiSetupAll() {
  const deckKeys = Object.keys(AI_DECKS);
  const offset = Math.floor(Math.random()*deckKeys.length);
  G.players.forEach((p,i)=>{
    if(p.isHuman)return;
    const race=deckKeys[(offset+i-1)%deckKeys.length];
    p.ai={race,deck:AI_DECKS[race],aggression:.5+(i-1)*.25};
  });
}

function isWall(def) { return def.range <= 45; }

/* 在偏好列附近找空格（行从中间向外扫描） */
function aiFindCell(p, preferCol) {
  const rows = Array.from({length:CFG.ROWS},(_,i)=>i).sort((a,b)=>Math.abs(a-(CFG.ROWS-1)/2)-Math.abs(b-(CFG.ROWS-1)/2));
  const cols = [];
  for (let off = 0; off < CFG.COLS; off++) {
    const c1 = preferCol + off, c2 = preferCol - off;
    if (c1 < CFG.COLS) cols.push(c1);
    if (c2 >= 0 && off > 0) cols.push(c2);
  }
  for (const c of cols) for (const r of rows) if (cellFree(p, c, r)) return { col: c, row: r };
  return null;
}

function aiAct(p) {
  const a = p.ai;
  if (!a) return;
  const w = G.wave;

  // Keep enough gold for defenders while investing in the same mines as humans.
  if (w >= 3 && p.mines.length < Math.min(MINE.LIMIT, Math.floor(w / 3)) && p.gold >= MINE.COST + 180) buyMine(p);
  const mine = p.mines.find(m => m.level < MINE.LEVELS.length && p.gold >= MINE.LEVELS[m.level - 1].upgrade + 300);
  if (mine) upgradeMine(p, mine.id);

  // 1) 强化国王（关键节点，留足买兵钱）
  const king = G.kings[p.team];
  const stat = king.hp < king.max * .5 ? 'health'
    : ['health', 'attack', 'regen'].reduce((best, key) => king.upgrades[key] < king.upgrades[best] ? key : best, 'health');
  const kCost = kingUpgradeCost(king, stat);
  if ([5, 11, 18, 24].includes(w) && p.gold >= kCost + 150) kingUpgrade(p, stat);
  if (w > 24 && p.gold >= kCost + 220) kingUpgrade(p, stat);

  // 2) 补墙 / 买输出
  let walls = p.fighters.filter(f => isWall(f.def)).length;
  const desiredWalls = Math.min(3 + Math.ceil(w / 8), 6);
  const wallIds = a.deck.filter(id => isWall(UNITS[id]));
  const rangedIds = a.deck.filter(id => !isWall(UNITS[id]));
  const supportIds = a.deck.filter(id => ['治疗','辅助'].includes(UNITS[id].role));
  const needsSupport = w >= 3 && !p.fighters.some(f => ['治疗','辅助'].includes(f.def.role));
  if (needsSupport) {
    const pick = supportIds.find(id=>p.gold>=UNITS[id].cost+60);
    const cell = pick && aiFindCell(p,3);
    if (cell) buyFighter(p,pick,cell.col,cell.row);
  }

  let buys = 0;
  while (buys < 6) {
    let pick = null, cell = null;
    if (walls < desiredWalls) {
      // 买得起最便宜的墙，否则攒钱
      const affordable = wallIds.filter(id => UNITS[id].cost <= p.gold).sort((x, y) => w>=7 ? UNITS[y].cost-UNITS[x].cost : UNITS[x].cost-UNITS[y].cost);
      if (!affordable.length) break;
      pick = affordable[0];
      cell = aiFindCell(p, 1);
    } else {
      const affordable = rangedIds.filter(id => UNITS[id].cost <= p.gold - 20 && !['治疗','辅助'].includes(UNITS[id].role));
      if (!affordable.length) break;
      // 2/3 概率买最贵（更高级兵），1/3 随机
      pick = Math.random() < 0.33
        ? affordable[Math.floor(Math.random() * affordable.length)]
        : affordable.sort((x, y) => UNITS[y].cost - UNITS[x].cost)[0];
      cell = aiFindCell(p, 3 + Math.floor(Math.random() * 3));
    }
    if (!cell) break;
    if (!buyFighter(p, pick, cell.col, cell.row)) break;
    if (isWall(UNITS[pick])) walls++;
    buys++;
  }

  // 3) 升级现有兵（每波 35% 概率）
  if (Math.random() < 0.35) {
    const upgradable = p.fighters.filter(f => f.def.up && p.gold >= UNITS[f.def.up].purchaseCost + 80);
    if (upgradable.length) {
      const f = upgradable[Math.floor(Math.random() * upgradable.length)];
      upgradeFighter(p, f);
    }
  }

  // 4) 雇佣兵施压
  if (w >= 4) {
    let sends = 0;
    const enemiesOfAi = G.players.filter(q => q.team !== p.team);
    while (sends < 2) {
      if (p.gold < 300 || !enemiesOfAi.length) break;
      const affordable = Object.keys(MERCS).filter(id => MERCS[id].unlockWave<=G.wave && MERCS[id].cost <= p.gold - 150);
      if (!affordable.length) break;
      const mid = affordable[Math.floor(Math.random() * affordable.length)];
      const tgt = enemiesOfAi[Math.floor(Math.random() * enemiesOfAi.length)];
      if (!sendMerc(p, tgt, mid)) break;
      sends++;
    }
  }
}
