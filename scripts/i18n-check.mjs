import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {english} from '../web/translations.mjs';
import {t,setLanguage,getLanguage,detectLanguage} from '../web/i18n.mjs';
assert.equal(detectLanguage(['zh-CN']),'zh-CN');assert.equal(detectLanguage(['zh-TW']),'zh-CN');assert.equal(detectLanguage(['ja-JP']),'en');assert.equal(detectLanguage([]),'en');
setLanguage('en');assert.equal(t('设置'),'Settings');assert.equal(t('已加载 local同步歌词'),'Loaded local synced lyrics');assert.match(t('服务要求等待，请在 15 秒后重试'),/15 seconds/);assert.equal(t('背景不透明度 '),'Background opacity ');assert.equal(t(' · 已暂停'),' · Paused');
setLanguage('zh-CN');assert.equal(t('Settings'),'设置');assert.equal(t('外观'),'外观');setLanguage('unsupported');assert.equal(getLanguage(),'en');
for(const [key,value] of Object.entries(english)){assert.ok(value.trim(),key);assert.ok(!/[\u3400-\u9fff]/u.test(value),'English translation contains Chinese: '+key);}
for(const file of ['settings.js','board.js']){const source=await readFile(new URL('../web/'+file,import.meta.url),'utf8');for(const match of source.matchAll(/t\('([^']*)'\)/g)){const key=match[1];if(/[\u3400-\u9fff]/u.test(key)&&!key.startsWith(' · '))assert.ok(english[key],'Missing English message: '+key);}}
console.log('Language checks passed: locale detection, both directions, notices, whitespace, fallback and UI message coverage.');
