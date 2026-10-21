// Read public Blizzard unit showcase assets and keep their source URLs alongside the files.
const fs=require('node:fs'),path=require('node:path');
const ORIGIN='https://classic.battle.net';
const cache=path.resolve('.cache/classic-art'),out=path.resolve('assets/unit-art/classic');
fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(out,{recursive:true});
async function get(url){const response=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(response.status+' '+url);return Buffer.from(await response.arrayBuffer());}
async function html(url){const file=path.join(cache,Buffer.from(url).toString('base64url')+'.html');if(fs.existsSync(file))return fs.readFileSync(file,'utf8');const data=await get(url);fs.writeFileSync(file,data);return data.toString('utf8');}
async function pool(items,fn){let at=0;await Promise.all(Array.from({length:5},async()=>{while(at<items.length){const item=items[at++];try{await fn(item);}catch(e){console.log('skip',item,e.message);}}}));}
const urls=new Set(),assets=new Map();
function collect(page,body){
 for(const m of body.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)/gi)){
  const url=new URL(m[1],page);
  if(url.origin!==ORIGIN||!(/\/images\/.*(?:\/animations\/|\/creeps\/).+\.gif$/i.test(url.pathname)||/\/images\/nightelf\/buildings\/[a-z]+\.gif$/i.test(url.pathname)))continue;
  if(/thumb|icon|commandaura|bloodlust|spell|evasion|slam|upgrade|poison|slow|frostbolt/i.test(url.pathname))continue;
  assets.set(url.href,{url:url.href,page,file:url.pathname.split('/').filter(Boolean).slice(2).join('-').toLowerCase()});
 }
}
(async()=>{
 const seeds=['human/units/footman.shtml','orc/units/grunt.shtml','nightelf/units/archer.shtml','undead/units/ghoul.shtml','neutral/creeps.shtml','neutral/','neutral/goblins.shtml','neutral/clockwerkgoblin.shtml','neutral/grizzlybear.shtml','nightelf/buildings/treeoflife.shtml'];
 for(const seed of seeds){const page=ORIGIN+'/war3/'+seed;try{const body=await html(page);collect(page,body);
  for(const m of body.matchAll(/href\s*=\s*["']([^"']+\.shtml(?:#[^"']*)?)["']/gi)){
   const url=new URL(m[1],page);url.hash='';
   if(url.origin===ORIGIN&&(/\/war3\/(human|orc|nightelf|undead)\/(?:units|buildings)\//.test(url.pathname)||/\/war3\/neutral\/(?!creep|building|critter|goblin|index)/.test(url.pathname)))urls.add(url.href);
  }
 }catch(e){console.log('seed skipped',seed,e.message);}}
 await pool([...urls],async page=>collect(page,await html(page)));
 console.log('Discovered',urls.size,'unit pages and',assets.size,'showcase images');
 const saved=[];
 await pool([...assets.values()],async item=>{
  const file=path.join(out,item.file);if(!fs.existsSync(file)){const data=await get(item.url);if(!data.subarray(0,6).toString().startsWith('GIF8'))throw Error('not GIF');fs.writeFileSync(file,data);}
  saved.push(item);
 });
 saved.sort((a,b)=>a.file.localeCompare(b.file));fs.writeFileSync('assets/unit-art/classic-sources.json',JSON.stringify({owner:'Blizzard Entertainment',origin:ORIGIN,assets:saved},null,2)+'\n');
 console.log('Saved',saved.length,'original showcase assets');
})().catch(e=>{console.error(e);process.exitCode=1;});
