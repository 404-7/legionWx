'use strict';
// Serializable combat orders. Targets use IDs, never cyclic object references.
function combatAgent(unit){
  if(!unit.entityId)unit.entityId=++G.entitySerial;
  if(!unit.brain)resetCombatAgent(unit);
  return unit.brain;
}
function resetCombatAgent(unit){
  unit.brain={state:'guard',targetId:null,scan:0,lock:0,lost:0,chase:0,blocked:0,ignoreId:null,ignore:0,
    returning:false,reacquire:0,threat:{},windup:null};
  unit.moving=false;
}
function advanceCombatBrain(unit,dt){
  const b=combatAgent(unit);unit.moving=false;
  for(const key of ['scan','lock','ignore','reacquire'])b[key]=Math.max(0,b[key]-dt);
  for(const [id,t] of Object.entries(b.threat)){t.life-=dt;t.value*=Math.exp(-.35*dt);if(t.life<=0)delete b.threat[id];}
  return b;
}
function recordCombatThreat(unit,attacker,amount){
  if(!attacker||attacker===unit||!(amount>0)||attacker.hp<=0)return;
  const b=combatAgent(unit),id=(combatAgent(attacker),attacker.entityId);
  const prior=b.threat[id]?.value||0;b.threat[id]={value:Math.min(15,prior+Math.min(amount,120)*.035),life:COMBAT_AI.THREAT_LIFE};
  if(!b.targetId)b.scan=0;
}
function healingThreat(p,healer,patient,amount){
  if(!(amount>0))return;
  for(const e of p.enemies)if(e.hp>0&&Math.hypot(e.x-patient.x,e.y-patient.y)<220)recordCombatThreat(e,healer,amount*.25);
}
function forgetCombatTarget(unit,returning=false){
  const b=combatAgent(unit);b.ignoreId=b.targetId;b.ignore=COMBAT_AI.IGNORE;
  b.targetId=null;b.windup=null;b.chase=0;b.blocked=0;b.lost=0;b.lock=0;b.scan=0;
  b.returning=returning;b.reacquire=returning?COMBAT_AI.REACQUIRE:0;
}
function chooseCombatTarget(unit,candidates,options,dt){
  const b=advanceCombatBrain(unit,dt),sense=options.sense,leash=options.leash??Infinity;
  const distance=e=>Math.hypot(e.x-unit.x,e.y-unit.y);
  const eligible=e=>e!==unit&&e.hp>0&&!(e.deadT>0)&&(!options.canTarget||options.canTarget(e))&&Math.hypot(e.x-options.x,e.y-options.y)<=leash+60;
  let target=candidates.find(e=>{combatAgent(e);return e.entityId===b.targetId&&eligible(e);})||null;
  if(b.targetId&&!target){const escaped=candidates.some(e=>e.entityId===b.targetId&&e.hp>0);forgetCombatTarget(unit,!!options.returnHome&&escaped);if(!escaped)b.ignore=0;}
  if(target){
    b.lost=distance(target)>Math.max(sense*1.8,options.reach+80)?b.lost+dt:0;
    if(b.lost>=COMBAT_AI.LOST||b.blocked>=COMBAT_AI.BLOCKED||Math.hypot(unit.x-options.x,unit.y-options.y)>leash||(b.chase>=COMBAT_AI.CHASE&&distance(target)>options.reach)){forgetCombatTarget(unit,!!options.returnHome);target=null;}
  }
  if(b.returning||b.reacquire>0)return null;
  if(target&&(b.lock>0||b.windup))return target;
  if(b.scan>0)return target;
  b.scan=COMBAT_AI.SCAN;
  const score=e=>200/(40+distance(e))+(b.threat[e.entityId]?.value||0)+(distance(e)<=options.reach?.75:0);
  const incumbentScore=target?score(target):-Infinity;
  let best=target,bestScore=incumbentScore;
  for(const e of candidates){
    if(!eligible(e))continue;combatAgent(e);
    if(e.entityId===b.ignoreId&&b.ignore>0)continue;
    if(distance(e)>sense&&!(b.threat[e.entityId]?.value>0&&distance(e)<=sense*1.8))continue;
    const s=score(e);
    if(s>bestScore&&(!target||s>incumbentScore*COMBAT_AI.SWITCH_RATIO)){best=e;bestScore=s;}
  }
  if(best&&best.entityId!==b.targetId){
    b.targetId=best.entityId;b.lock=COMBAT_AI.LOCK;b.chase=0;b.blocked=0;b.lost=0;b.windup=null;
    b.anchorX=unit.x;b.anchorY=unit.y;
  }
  return best;
}
function defenseTargets(p){return [...p.enemies,...G.kings[p.team].leaks.filter(e=>e.ownerId===p.id)];}
function inDefenseField(p,x,y){return x>=p.fx&&x<=p.fx+CFG.FIELD_W&&y>=p.fy&&y<=p.fy+CFG.FIELD_H;}
function defenseWalkable(p,x,y){
  if(G.players.some(ally=>ally.team===p.team&&inDefenseField(ally,x,y)))return true;
  const k=G.kings[p.team],r=38;
  return (Math.abs(x-p.exitX)<=r&&y>=12&&y<=CFG.H-12)||
    (Math.abs(y-CFG.ROAD_Y)<=r&&x>=Math.min(k.x,p.exitX)-r&&x<=Math.max(k.x,p.exitX)+r)||
    (Math.abs(x-k.x)<=r&&y>=Math.min(k.y,CFG.ROAD_Y)-r&&y<=Math.max(k.y,CFG.ROAD_Y)+r);
}
function defenseLineClear(p,a,b){
  if(inDefenseField(p,a.x,a.y)&&inDefenseField(p,b.x,b.y))return true;
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/22));
  for(let i=1;i<=n;i++)if(!defenseWalkable(p,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;
  return true;
}
function defenseWaypoint(p,unit,goal){
  if(defenseLineClear(p,unit,goal))return goal;
  const k=G.kings[p.team],nodes=[{x:unit.x,y:unit.y},goal,{x:p.exitX,y:unit.y},
    {x:p.exitX,y:goal.y},{x:p.exitX,y:CFG.ROAD_Y},{x:k.x,y:CFG.ROAD_Y},{x:k.x,y:k.y}];
  const distances=nodes.map(()=>Infinity),previous=[],done=new Set();distances[0]=0;
  for(let step=0;step<nodes.length;step++){
    let at=-1;for(let i=0;i<nodes.length;i++)if(!done.has(i)&&(at<0||distances[i]<distances[at]))at=i;
    if(at<0||!Number.isFinite(distances[at]))break;
    if(at===1){let next=1;while(previous[next]!==0&&previous[next]!==undefined)next=previous[next];return nodes[next];}
    done.add(at);
    for(let i=1;i<nodes.length;i++)if(!done.has(i)&&defenseLineClear(p,nodes[at],nodes[i])){
      const d=distances[at]+Math.hypot(nodes[i].x-nodes[at].x,nodes[i].y-nodes[at].y);
      if(d<distances[i]){distances[i]=d;previous[i]=at;}
    }
  }
  return {x:p.exitX,y:Math.max(12,Math.min(CFG.H-12,unit.y))};
}
function moveCombatUnit(p,unit,goal,speed,dt,stop=0){
  if(!(speed>0)||!(dt>0))return false;
  const waypoint=p.arenaView?goal:defenseWaypoint(p,unit,goal);
  const dx=waypoint.x-unit.x,dy=waypoint.y-unit.y,d=Math.hypot(dx,dy);
  const step=Math.min(Math.max(0,d-(waypoint===goal?stop:0)),speed*dt);
  if(step<.01){if(unit.brain?.targetId&&Math.hypot(goal.x-unit.x,goal.y-unit.y)>stop+.1)unit.brain.blocked=(unit.brain.blocked||0)+dt;return false;}
  if(unit.brain)unit.brain.blocked=0;
  unit.x+=dx/d*step;unit.y+=dy/d*step;unit.moving=true;unit.facing=Math.atan2(dy,dx);return true;
}
function guardHome(p,f){const owner=G.players[f.ownerId]||p;return {x:f.homeX??owner.gx+(f.col+.5)*CFG.CELL,y:f.homeY??owner.gy+(f.row+.5)*CFG.CELL};}
function idleGuard(p,f,dt){
  const b=combatAgent(f),home=guardHome(p,f);
  if(p.arenaView){b.state='guard';return;}
  let goal=home;
  if(!b.returning&&G.phase==='combat'&&p.spawnList.length){
    goal={x:home.x,y:Math.max(p.gy+24,Math.min(p.gy+CFG.GRID_H-24,home.y-p.direction*COMBAT_AI.ADVANCE))};
    b.state='advance';
  }else b.state='return';
  if(Math.hypot(goal.x-f.x,goal.y-f.y)<=COMBAT_AI.RETURN_EPS+.05){
    if(goal===home){f.x=home.x;f.y=home.y;b.returning=false;b.state='guard';}return;
  }
  moveCombatUnit(p,f,goal,f.def.speed*(f.slowF??1),dt,COMBAT_AI.RETURN_EPS);
}
function separateDefenseUnits(p,dt){
  const units=[...p.fighters,...defenseTargets(p)].filter(u=>u.hp>0&&!(u.deadT>0));
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
    const a=units[i],b=units[j],minimum=(a.r||10)+(b.r||10);let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>=minimum)continue;
    if(d<.01){const angle=(i*37+j*17)*2.39996;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    const push=Math.min((minimum-d)*.4,30*dt);
    for(const [u,sign] of [[a,-1],[b,1]]){const x=u.x+sign*dx/d*push,y=u.y+sign*dy/d*push;if(defenseWalkable(p,x,y)){u.x=x;u.y=y;}}
  }
}
