const fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync('js/source341.js','utf8')+';globalThis.units=[...SOURCE341.units,...SOURCE341.summons]',c);
const catalog=JSON.parse(fs.readFileSync('assets/unit-art/classic-sources.json','utf8'));
const files=catalog.assets.map(a=>a.file),find=name=>files.find(f=>f===name+'.gif')||files.find(f=>f.endsWith('-'+name+'.gif'));
const models={thecaptain:'footman',bloodelfspellthief:'footman',warwagon:'siegeengine',warwagon_v1:'siegeengine',
 gnoll:'gnoll',ogre:'ogre',ogrelord:'ogrelord',harpy:'harpy',harpywitch:'harpywitch',foresttroll:'foresttroll',foresttrolltrapper:'foresttrolltrapper',
 grizzlybear:'bear',druidoftheclaw:'druidclaw',dragonspawnblue:'bluedragonspawn',reddragon:'reddragon',chaosspaceorc:'rifleman',marine:'rifleman',
 goblinzeppelin:'zeppelin',undeadairbarge:'zeppelin',golemstatue:'wargolem',irongolem:'wargolem',
 ent:'ent',ancientprotector:'ent',archer:'nightelf-units-animations-archer',dryad:'driad',faeriedragon:'faeriedragon',chimaera:'chimaera',
 ancientoflore:'ent',ancientofwonder:'ent',mountaingiant:'mountaingiant',treeoflife:'treeoflife',corruptedtreeoflife:'corruptedent',
 skeleton:'skeleton',skeletonorc:'skeletalorc',skeletonarcher:'skeletonarcher',skeletonmage:'skeletalmage',cryptfiend:'cryptfiend',nerubianspiderlord:'nurobianlord',
 felgaurd:'felguard',felgaurdblue:'felguard',obsidianstatue:'obsidianstatue',facelessone:'facelessone',eredarwarlock:'eredar',infernal:'infernal',doomguard:'doomguard',
 wisp:'wisp',vengeance:'avatarofvengeance',waterelemental:'waterelement',seaelemental:'seaelement',owlscout:'owlscout',druidofthetalon:'druidtalon',
 rockgolem:'rockgolem',fleshgolem:'rockgolem',humanmage:'banditmage',heroarchmageghost:'archmage',netherdragon:'netherdragon',phoenix:'phoenix',
 banshee:'banshee',bansheeghost:'bansheeghost',spiritofvengeance:'spiritofvengeance',shade:'shade',banditlord:'banditlord',medivh:'archmage',
 voidwalker:'voidwalker',revenant:'revenant',revenantofthewaves:'revenant',spiritwyvern:'shadowwolf',priest:'priest',spiritwalker:'spiritwalker',
 goblinsapper:'goblinshredder',mortarteam:'mortarteam',herogoblinalchemist:'goblinshredder',peon:'peon',wolfrider:'wolfrider',headhunter:'headhunter',headhunter_v1:'berserker',
 witchdoctor:'witchdoctor',shaman:'shaman',demoness:'succubus',demonessblue:'succubus',tauren:'tauren',sasquatch:'sasquatch',murgulslave:'murgul',
 murlocmutant:'murlockmutant',murgulreaver:'murlockflesheater',murgulbloodgill:'murgul',eggsack1:null,windserpent:'dragonhawk',lobstrokkred:'lobstrocity',lobstrokkgreen:'lobstrocity',
 nagasiren:'seawitch',nagasummoner:'seawitch',snapdragon:'salamander',nagamyrmidon:'unbroken',seagiantgreen:'seagiant',hydra:'hydra',
 hippogryph:'hippogryph',riddenhippogryph:'hippogryphrider',highelfpeasant:'peasant',bloodelflieutenant:'footman',watcher:'huntress',huntress:'huntress',
 illidanevilcaged:'demonhunter',sorceress_v1:'sorceress',assassin:'bandit',herowarden:'warden',icetrollshadowpriest:'icetrollpriest',azuredragonwelp:'azuredragon',
 goblinlandmine:null,koboldgeomancer:'koboldgeomancer',herotinkerrobot:'goblinshredder',goblinmobileturret:'wargolem',goblindrillbot3000_a_005:'wargolem',
 gyrocopter_v1:'flyingmachine',minicopter:'flyingmachine',goblinsteamroller:'siegeengine',goblinassaulttank:'siegeengine',
 peasant:'peasant',militia:'militia',highelfarcher:'archer',sylvanuswindrunner:'darkranger',priest_v1:'priest',lordgarithos:'knight',gryphonrider:'gryphonrider',
 grunt:'grunt',chaosgrunt:'grunt',chaosorcrange:'grunt',chaoswarlockgreen:'stormreaver',chaoswarlock:'stormreaver',chaoswolfrider:'wolfrider',
 orcwarlockred:'stormreaver',orcwarlockguldan:'witchdoctor',riderlesswyvern:'wyvernrider',wyvernrider:'wyvernrider',chaoswarlord:'blademaster',thrall:'farseer',
 acolyte:'acolyte',ghoul:'ghoul',meatwagon:'meatwagon',infernalcannoncannon:'infernalmachine',necromancer:'necromancer',kelthuzad:'necromancer',
 kelthuzadghost:'lich',zombie:'abomination',abominationcin:'abomination',pitlord:'pitlord',frostwyrm:'frostwyrm'};
const overrides={peewee:'footman',infantry:'rifleman',footman:'footman',fiend:'feldemon',fanatic:'feldemon',diablotic:'necromancer',
 greymane:'bear',veteran:'footman',keeper_of_souls:'destroyer',maverick:'dragonhawk',tuskarr:'tuskarr',tuskarr_spearman:'tuskarr',frost_wolf:'whitewolf',pandaren:'pandarenbrewmaster',
 polar_bear:'polarbear',magnataur:'magnataur',wandigoo:'wendigo',ancient_wandigoo:'wendigoshaman',azure_dragon:'azuredragon'};
const approximations=new Set(['thecaptain','bloodelfspellthief','chaosspaceorc','marine','undeadairbarge','ancientprotector','ancientoflore','ancientofwonder',
 'corruptedtreeoflife','fleshgolem','heroarchmageghost','medivh','spiritwyvern','goblinsapper','herogoblinalchemist','windserpent','nagasiren','nagasummoner','snapdragon','nagamyrmidon','highelfpeasant',
 'bloodelflieutenant','watcher','illidanevilcaged','assassin','herotinkerrobot','goblinmobileturret','goblindrillbot3000_a_005','minicopter','goblinsteamroller','goblinassaulttank',
 'highelfarcher','sylvanuswindrunner','lordgarithos','chaosgrunt','chaosorcrange','chaoswarlockgreen','chaoswarlock','chaoswolfrider','orcwarlockred','orcwarlockguldan','riderlesswyvern','chaoswarlord','thrall','kelthuzad','kelthuzadghost','zombie']);
const frames={};
for(const r of c.units){
 const source=r.map.fields,model=String(source.umdl||'').split('\\').pop().replace(/\.mdl$/i,'').toLowerCase();
 const key=overrides[r.id]??models[model];
 if(key===null){frames[r.id]={kind:r.id==='egg_sack'?'egg':'mine',sourceModel:source.umdl||null};continue;}
 const file=find(key||(/wolf/i.test(r.english)?'spiritwolf':r.race==='goblin'?'goblinshredder':'skeleton'));
 if(!file)throw Error('Missing classic sprite '+r.id+' '+key);
 const tint=[source.uclr??255,source.uclg??255,source.uclb??255];
 frames[r.id]={file:file.replace(/\.gif$/,'.png'),sourceModel:source.umdl||null,tint,
   match:approximations.has(model)||!key?'closest-classic':'model-family',scale:r.elite?1.04:1};
}
const extra={king_0:'paladin',king_1:'deathknight',en_grunt:'murlock',en_runner:'gnoll',en_brute:'ogre',en_knight:'skeletalorc',en_shaman:'darktrollpriest',en_slime:'sludgebeast',en_ghost:'bansheeghost',en_bat:'harpy',en_boss:'pitlord',m_imp:'felguard',m_bandit:'bandit',m_stone:'rockgolem',m_wyvern:'wyvernrider',m_abyss:'facelessone',m_ancient:'seagiant'};
for(const [id,key] of Object.entries(extra)){const file=find(key);if(!file)throw Error(key);frames[id]={file:file.replace(/\.gif$/,'.png'),tint:[255,255,255],scale:1};}
fs.writeFileSync('js/art-manifest.js',"'use strict';\n// Generated by scripts/build-classic-art.cjs; Blizzard classic unit showcases.\nconst CLASSIC_ART_FRAMES = "+JSON.stringify(frames,null,2)+';\n');
fs.writeFileSync('assets/unit-art/mapping.json',JSON.stringify({source:'https://classic.battle.net/war3/',frames},null,2)+'\n');
console.log('Mapped',Object.keys(frames).length,'game sprites to',new Set(Object.values(frames).map(r=>r.file).filter(Boolean)).size,'classic assets');
