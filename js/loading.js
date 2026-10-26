'use strict';
const LoadingUI=(()=>{
 const tasks=new Map(),buttons=new Map();let serial=0,activatedButton=null;
 function render(){const node=document.getElementById('loadingStatus');if(!node)return;const list=[...tasks.values()];node.hidden=!list.length;node.textContent=list.length?list.at(-1).label+(list.length>1?`（${list.length} 项）`:''):'';}
 function locator(button){if(!button)return ()=>null;if(button.id)return ()=>document.getElementById(button.id);for(const attr of ['data-king-spell','data-upgrade-uid','data-king-stat','data-merc-detail-send'])if(button.hasAttribute(attr)){const value=button.getAttribute(attr);return ()=>[...document.querySelectorAll(`[${attr}]`)].find(n=>n.getAttribute(attr)===value);}return ()=>button;}
 function mark(button){if(!buttons.has(button))buttons.set(button,button.disabled);button.classList.add('is-loading');button.setAttribute('aria-busy','true');button.disabled=true;}
 function begin(label,button=null){const id=++serial;tasks.set(id,{label,button,locate:locator(button)});if(button)mark(button);render();return id;}
 function update(id,label){const task=tasks.get(id);if(task){task.label=label;render();}}
 function end(id){const task=tasks.get(id);if(!task)return;tasks.delete(id);const button=task.button;if(button&&![...tasks.values()].some(t=>t.button===button)){button.disabled=buttons.get(button);buttons.delete(button);button.classList.remove('is-loading');button.removeAttribute('aria-busy');}render();}
 function enforce(){for(const task of tasks.values()){const current=task.locate();if(current){task.button=current;mark(current);}}for(const button of buttons.keys())if(![...tasks.values()].some(t=>t.button===button))buttons.delete(button);}
 async function run(label,work,button=null){const id=begin(label,button);try{return await work();}finally{end(id);}}
 function eventButton(){return activatedButton;}
 document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(button?.classList.contains('is-loading')){event.preventDefault();event.stopImmediatePropagation();return;}activatedButton=button;setTimeout(()=>{if(activatedButton===button)activatedButton=null;},0);},true);
 return {begin,update,end,enforce,run,eventButton};
})();
