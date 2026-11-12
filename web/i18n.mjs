import {english} from './translations.mjs';
export const supportedLanguages=['zh-CN','en'];
export function detectLanguage(languages=globalThis.navigator?.languages||[globalThis.navigator?.language||'en']){return /^zh(?:-|$)/i.test(languages[0]||'')?'zh-CN':'en';}
let language=detectLanguage();
try{const saved=globalThis.localStorage?.getItem('snowline-language');if(supportedLanguages.includes(saved))language=saved;}catch{}
const reverse=new Map(Object.entries(english).map(([zh,en])=>[en,zh]));
export function getLanguage(){return language;}
export function t(input){
 if(input===null||input===undefined)return '';
 const source=String(input);if(source.startsWith(' · '))return ' · '+t(source.slice(3));if(source.trim()!==source){const m=source.match(/^(\s*)([\s\S]*?)(\s*)$/);return m[1]+t(m[2])+m[3];}const key=reverse.get(source)||source;
 if(language==='zh-CN')return key;
 if(english[key])return english[key];
 if(/^Snowline Lyrics .* · Rust · Windows 便携测试版 · MIT licensed code$/.test(key))return key.replace('Windows 便携测试版','Windows portable preview');
 if(key==='Snowline Lyrics · 设置')return 'Snowline Lyrics · Settings';
 let m=key.match(/^已加载 (.+?)(同步歌词|普通歌词 · 全文阅读)$/);if(m)return `Loaded ${m[1]==='local'?'local':m[1]} ${m[2]==='同步歌词'?'synced lyrics':'plain lyrics · full text'}`;
 m=key.match(/^歌词服务 HTTP (\d+)，请稍后重试(?:（等待 (\d+) 秒）)?$/);if(m)return `Lyric service HTTP ${m[1]}. Please retry later${m[2]?` (wait ${m[2]} seconds)`:''}`;
 m=key.match(/^服务要求等待，请在 (\d+) 秒后重试$/);if(m)return `The service requests a delay. Retry in ${m[1]} seconds.`;
 if(key.includes(' · '))return key.split(' · ').map(t).join(' · ');
 return key;
}
const textRecords=[],attributeRecords=[];
const dynamicIds=new Set(['title','artist','current','next','status','lyrics-status','media-status','full-text','manual-hint','manual-toggle','manual-message','import-status','appearance-result','sync-backup-result','backup-result','background-name','source','versions','manual-lines','language-result']);
const feedbackIds=['manual-message','import-status','appearance-result','sync-backup-result','backup-result','language-result'];
function apply(){
 if(typeof document==='undefined')return;
 document.documentElement.lang=language;document.title=t(document.body.dataset.page==='settings'?'Snowline Lyrics · 设置':'Snowline Lyrics');
 for(const {node,source} of textRecords)if(node.isConnected)node.nodeValue=t(source);
 for(const {node,attr,source} of attributeRecords)if(node.isConnected)node.setAttribute(attr,t(source));
 for(const id of feedbackIds){const el=document.getElementById(id);if(el?.textContent)el.textContent=t(el.textContent);}
 for(const button of document.querySelectorAll('[data-language]'))button.setAttribute('aria-pressed',String(button.dataset.language===language));
}
export function setLanguage(value){if(!supportedLanguages.includes(value))value='en';const changed=value!==language;language=value;try{localStorage.setItem('snowline-language',value);}catch{}apply();if(changed&&typeof document!=='undefined')document.dispatchEvent(new CustomEvent('snowline-language-changed',{detail:value}));}
export function initI18n(){
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
 while(walker.nextNode()){const node=walker.currentNode,parent=node.parentElement;if(!parent||parent.closest('script,style,[data-language]'))continue;if([...dynamicIds].some(id=>parent.closest(`[id="${id}"]`)))continue;const source=node.nodeValue;if(/[\u3400-\u9fff]/.test(source))textRecords.push({node,source});}
 for(const node of document.querySelectorAll('[title],[aria-label]'))for(const attr of ['title','aria-label']){const source=node.getAttribute(attr);if(source&&/[\u3400-\u9fff]/.test(source))attributeRecords.push({node,attr,source});}
 apply();
}
export async function syncLanguage(settings,save){const selected=supportedLanguages.includes(settings.language)?settings.language:detectLanguage();if(!supportedLanguages.includes(settings.language))await save(selected);setLanguage(selected);}
