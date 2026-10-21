'use strict';
// Typed adapters for Warcraft object-editor abilities. Original fields/tooltips stay in SOURCE341.
const ABILITIES341=Object.fromEntries(SOURCE341.abilities.map(a=>[a.id,a]));
const skillValue=(a,key,fallback=0)=>{
  const entry=Object.entries(a.fields).find(([k])=>k.split(':')[0].toLowerCase()===key.toLowerCase());
  return entry?entry[1]:fallback;
};
const skillText=a=>a.fields['aub1:1:0']||'';
const percentText=(text,pattern,fallback=0)=>Number(text.match(pattern)?.[1]??fallback)/100;
function compile341Skills(row) {
  const out={casts:[],sources:[],pending:[]};
  const seen=new Set();
  const add=(id,indirect=false)=>{
    if(seen.has(id))return;seen.add(id);
    const a=ABILITIES341[id];if(!a)return;
    const v=(key,fallback=0)=>skillValue(a,key,fallback);
    const text=skillText(a)||((row.buildingSkills||[]).map(key=>ABILITIES341[key]).filter(Boolean).find(b=>skillValue(b,'anam','')===v('anam','')&&skillText(b))?.fields['aub1:1:0']||'');
    const name=v('anam',v('atp1',id)), r=v('aare',row.rawRange)*SOURCE341.rangeScale;
    const dur=v('adur',Number(text.match(/(?:for|Lasts?)\s+(\d+(?:\.\d+)?)\s*sec/i)?.[1]||0));
    const mana=v('amcs'), cd=v('acdn',row.interval);
    const airOnly=v('atar','')==='air,enemies'||/air (?:enemies|units) only/i.test(text);
    let mapped=true;
    const cast=(kind,values)=>out.casts.push({id,kind,mana,cd,range:r,duration:dur,...values});
    switch(a.base) {
      case 'ACac': case 'ACat': {
        const p=v(a.base==='ACat'?'Ear1':'Cac1');
        if(p<0)out.weakenAura={p:-p,r};
        else if(p>0)out.aura={p,r,rangedOnly:a.base==='ACat'};
        break;
      }
      case 'ACnr': out.healAura={hps:v('Oar1'),r};break;
      case 'AIva':out.lifesteal=v('Ivam');break;
      case 'ACvp':out.vampAura={p:v('Uav1'),r};break;
      case 'ACav':out.armorAura={armor:v('Dev1',Number(text.match(/(\d+) additional armor/)?.[1]||0)),r};break;
      case 'SCae':out.hasteAura={p:v('Oae2'),r};break;
      case 'ACua': {
        const p=v('Uau1');if(p<0)out.slowAura={p:-p,r};else out.moveAura={p,r};break;
      }
      case 'ACba':out.manaAura={p:v('Hab1'),r};break;
      case 'ACct':case 'ANdb': {
        out.crit={c:v('Ocr1',Number(text.match(/(\d+)% chance (?:to deal|to do)/)?.[1]||10))/100,
          m:v('Ocr2',/triple/i.test(text)?3:/double/i.test(text)?2:1.6),airOnly};
        if(a.base==='ANdb')out.evasion=v('Ocr4',percentText(text,/(\d+)% (?:evasion|chance to evade)/));
        break;
      }
      case 'ACev':case 'ACes':out.evasion=v('Eev1',percentText(text,/(\d+)% chance/));break;
      case 'ACbh':out.bash={chance:v('Hbh1')/100,damage:v('Hbh3',Number(text.match(/(\d+) bonus damage/)?.[1]||0)),mult:v('Hbh2',1),duration:dur||2,boss:v('ahdu',.2)};break;
      case 'Aspo':case 'Aven': {
        const dps=v(a.base==='Aven'?'Poi1':'Spo1');
        const move=v('Spo2',percentText(text,/(?:movement (?:speed )?by|movement by)\s+(\d+)%/)),attack=v('Spo3',percentText(text,/attack(?: rate| speed)? by (\d+)%/));
        out.poison={dps,move,attack,duration:dur||5,stack:a.base==='Aven',airOnly};break;
      }
      case 'ACsw':cast('debuff',{move:v('Slo1'),attack:v('Slo2'),duration:dur});break;
      case 'AIcb':out.corrupt={armor:v('Iarp'),duration:dur||5};break;
      case 'Acri':case 'ACcr':cast('debuff',{move:v('Cri1'),attack:v('Cri2'),damage:v('Cri3'),duration:dur,boss:v('ahdu',dur)});break;
      case 'AHca':out.poison={dps:0,move:v('Hca2'),attack:v('Hca3'),duration:dur||5};out.flatDamage=v('Hca1');break;
      case 'AItn':out.flatDamage=(out.flatDamage||0)+v('Iatt');break;
      case 'ACsa':out.manaHit={id,damage:v('Hfa1'),mana,cd};break;
      case 'ACmf':out.manaShield={ratio:v('Nms2'),perMana:v('Nms1',1)};break;
      case 'Ansk':out.block={chance:v('Ssk1')/100,amount:v('Ssk3'),minimum:v('Ssk2')};break;
      case 'ACah':case 'AEah':out.reflect={p:v('Eah1'),r};break;
      case 'Adef':out.defend=v('Def1',1);break;
      case 'Ahea':cast('heal',{amount:v('Hea1'),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'AChv':cast('healChain',{amount:v('Ocl1'),n:v('Ocl2',4),falloff:v('Ocl3',.25),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'ANdh':cast('miss',{miss:v('Nsi2'),range:v('aran',500)*SOURCE341.rangeScale});break;
      case 'Awar':out.pulverize={chance:v('War1')/100,damage:v('War2'),r:v('War3')*SOURCE341.rangeScale};break;
      case 'Amim':out.magicImmune=true;break;
      case 'ACim':out.burn={dps:v('Eim1',10),r};break;
      case 'ACbf':cast('breath',{damage:v('Ucs1'),dps:v('Nbf5'),range:v('Ucs3',300)*SOURCE341.rangeScale});break;
      case 'ANcs':cast('aoe',{damage:Number(text.match(/up to (\d+) damage/)?.[1]||v('Ncs1')),n:99,stun:dur||1,range:v('aran',300)*SOURCE341.rangeScale});break;
      case 'AOmi':cast('illusion',{factor:v('Omi2',.5),taken:v('Omi3',2),duration:dur||60});break;
      case 'Apsh':add('A06Z',true);break;
      case 'AEfk':case 'Aroc': {
        const damage=v('Efk1'),n=v('Efk3',damage?Math.max(1,Math.round(v('Efk2',damage)/Math.abs(damage))):0);
        if(damage<0)cast('healGroup',{amount:-damage,n});
        else if(damage>0)cast('aoe',{damage,n});
        else mapped=/Dummy|visual|SFX/i.test(v('ansf',''));
        break;
      }
      case 'ACuf':if(String(v('atar','')).includes('friend'))cast('allyBuff',{haste:v('Uhf1'),drain:v('Uhf2'),duration:dur});
        else cast('haunt',{dps:v('Uhf2'),attack:Math.abs(v('Uhf1')),duration:dur});break;
      case 'AHtc':cast('aoe',{damage:v('Htc1'),n:99,move:v('Htc3'),attack:v('Htc4')});break;
      case 'Awrs':cast('aoe',{damage:v('Wrs1'),n:99,stun:dur});break;
      case 'AHtb':case 'ACtb':cast('bolt',{damage:v('Htb1'),stun:dur,boss:v('ahdu',1)});break;
      case 'ACen':case 'Aenr':cast('root',{duration:dur,boss:v('ahdu',1.5),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'AHwe':cast('summon',{rawId:v('Hwe1',''),count:v('Hwe2',1),duration:dur||60});break;
      case 'ACcl':cast('chain',{damage:v('Ocl1',Number(text.match(/dealing (\d+) damage/)?.[1]||0)),n:v('Ocl2'),falloff:v('Ocl3'),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'AOcl':cast('chain',{damage:v('Ocl1'),n:v('Ocl2',3),falloff:v('Ocl3'),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'ANfl':case 'AOfl':cast('aoe',{damage:v('Ocl1',40),n:v('Ocl2',3),range:v('aran',600)*SOURCE341.rangeScale});break;
      case 'ACro':cast('groupBuff',{damage:v('Roa1'),armor:v('Roa2'),duration:dur});break;
      case 'ACif':cast('selfBuff',{damage:v('Inf1'),armor:v('Inf2'),duration:dur});break;
      case 'Auhf':cast('selfBuff',{haste:v('Uhf1'),drain:v('Uhf2'),duration:dur});break;
      case 'Absk':case 'ACbl':cast('selfBuff',{haste:v('bsk2',v('Blo1')),duration:dur});break;
      case 'AIll':if(v('Iobu',''))add(v('Iobu',''),true);else mapped=false;break;
      case 'AIfb':out.flatDamage=(out.flatDamage||0)+v('Idam');break;
      case 'Apxf':cast('aoe',{damage:v('pxf1'),n:1,cd:v('acdn'),mana:0});break;
      case 'Asdg':case 'Asd2':case 'Asd3':out.explode={damage:v('Dda4'),range:v('Dda3')*SOURCE341.rangeScale};break;
      case 'AUfa':cast('armorBuff',{armor:v('Ufa2',3),duration:dur||10});break;
      case 'AUfn':cast('nova',{damage:v('Ufn2',Number(text.match(/deals (\d+) damage to the target/)?.[1]||0)),aoe:v('Ufn1'),duration:dur});break;
      case 'AUau':if(/Heartstopper/.test(name))out.heartstopper={p:.01,r};else mapped=false;break;
      case 'AImp':case 'Aimp':case 'Aasl':case 'Asph':case 'Alit':break; // Display/buff shells handled by explicit trigger adapters below.
      default:mapped=false;
    }
    if(!mapped&&text)out.pending.push(id);
    if(text||v('anam',''))out.sources.push(id);
  };
  for(const id of row.skillIds)add(id);
  // JASS-injected real abilities for icon/orb shells; IDs are from the supplied unprotected map.
  const injected={yggdrasil:['A029'],tree_of_life:['A02C'],forsaken_one:['A04B'],medicine_man:['A059'],mistress:['A05C'],tribesman:['A056'],alpha_male:['A056'],dark_mage:['A00X'],frost_wolf:['A09A'],egg_sack:['A06P'],
    orc_warlock:['A019'],thrall:['A02I'],druid:['A0BN'],pandaren:['A098']};
  for(const id of injected[row.id]||[])add(id,true);
  const f=row.map.fields;
  if(f.ua1w==='msplash')out.splash={p:.5,r:(f.ua1q||f.ua1h||100)*SOURCE341.rangeScale,groundOnly:!(f.ua1p||'').includes('air')};
  if(f.ua1w==='mbounce')out.chain={n:row.id==='oceanus'?2:row.id==='machine_turret'||row.id==='machine_robot'?2:1,f:.5};
  if(row.id==='hydra')out.multishot=3;
  if(row.id==='elite_archer'){out.multishot=3;out.casts=out.casts.filter(c=>c.id!=='A07M');}
  if(row.id==='fenix')out.focusManaDivisor=3;
  if(row.id==='fangtooth')out.feast={every:5,heal:25};
  if(row.id==='wolverine')out.berserk=true;
  if(row.id==='zeus')out.attackMana=1;
  if(row.id==='thunderbird')out.aftershock={damage:40,n:1,r:150,chance:1};
  if(row.id==='leviathan')out.aftershock={damage:50,n:3,r:75,chance:5/11};
  if(row.id==='skeletor')out.spree={chance:.3,damage:.33,duration:4};
  if(['bottom_feeder','king_claw'].includes(row.id))out.refund=.9;
  if(row.id==='steamroller')out.deathRawSummon='h0D5';
  if(row.id==='assault_tank')out.deathRawSummon='h0AX';
  if(row.id==='slavemaster')out.slaveTrade=true;
  if(row.id==='mutant')out.steroids=true;
  if(row.id==='frost_wolf'&&out.poison)out.poison.hpThreshold=.3;
  if(row.id==='egg_sack')for(const c of out.casts){c.hpThreshold=.1;c.invulnerable=true;}
  if(row.id==='meliai')out.mark=.25;
  if(row.id==='sword_mage')out.fireHit=60;
  if(row.id==='hydra')out.deathSummon={id:'mini_hydra',count:3};
  if(row.id==='tree_of_life')out.deathHeal={amount:150,n:6,r:150};
  if(row.id==='tree_of_knowledge')out.deathBlast={amount:200,n:15,r:150};
  if(row.id==='oracle')out.guardian={factor:.77,r:64,n:6};
  if(row.id==='small_land_mine')out.explode={damage:20,range:50};
  if(row.id==='medium_land_mine')out.explode={damage:40,range:75};
  if(row.id==='ultra_land_mine')out.explode={damage:60,range:100};
  if(['bone_warrior','skeletor','fire_archer','dark_mage'].includes(row.id))out.regenFlat=row.map.regen;
  // Building icons supply text even when the actual ability is injected by JASS.
  for(const id of row.buildingSkills||[])if(ABILITIES341[id]&&!out.sources.includes(id))out.sources.push(id);
  return out;
}
