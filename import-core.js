'use strict';
/* Pure parsing and validation helpers. OCR is advisory, never an authoritative brokerage feed. */
const ImportCore=(()=>{
 const clean=s=>String(s||'').replace(/[，,\s]/g,'').replace(/[−－ー]/g,'-').replace(/円|株/g,'');
 const numeric=s=>{const n=Number(clean(s));return Number.isFinite(n)?n:null;};
 const CODE=/\b(\d{4}|\d{3}[A-Z])\b/g;
 function parseCodes(text){const lines=String(text||'').toUpperCase().split(/\r?\n/);let high=[];for(let i=0;i<lines.length;i++){let line=lines[i];if(/買建|売建|買付|保有|現物|特定|一般|NISA|銘柄/.test(line)){for(let m of line.matchAll(CODE)){high.push(m[0]);}}}let all=[...new Set(high)];return all.length?all:[...new Set((String(text).toUpperCase().match(CODE)||[]).filter(c=>!/^20[0-9]{2}$/.test(c)))];}
 function valueAfter(text,label){let m=String(text).match(new RegExp(label+'\\s*[:：]?\\s*([-−－]?[0-9,，]+(?:\\.[0-9]+)?)','i'));return m?numeric(m[1]):null;}
 function parseMargin(t){return {cash:valueAfter(t,'委託保証金現金'),collateral:valueAfter(t,'代用有価証券評価額(?:合計)?'),effective:valueAfter(t,'実質保証金(?:\\(A\\))?'),principal:valueAfter(t,'建代金合計(?:\\(B\\))?'),rate:valueAfter(t,'委託保証金率(?:\\(A/B\\)[×x]100)?')};}
 function validatePosition(p){let e=[];if(!/^(\d{4}|\d{3}[A-Z])$/.test((p.code||'').toUpperCase()))e.push('銘柄コード');if(!['cash','long','short'].includes(p.kind))e.push('売買区分');if(!Number.isInteger(Number(p.qty))||Number(p.qty)<=0)e.push('株数');if(!Number.isFinite(Number(p.entry))||Number(p.entry)<=0)e.push('建単価');if(!Number.isFinite(Number(p.current))||Number(p.current)<=0)e.push('現在値');return e;}
 function reconcile(p){let diffs=[];if(p.marketValue!==null&&p.marketValue!==''&&Number.isFinite(Number(p.marketValue))){let calc=Number(p.current)*Number(p.qty);if(Math.abs(calc-Number(p.marketValue))>Math.max(1,calc*.001))diffs.push('評価額≠現在値×株数');}if(p.pnl!==null&&p.pnl!==''&&Number.isFinite(Number(p.pnl))){let calc=(Number(p.current)-Number(p.entry))*Number(p.qty)*(p.kind==='short'?-1:1);if(Math.abs(calc-Number(p.pnl))>Math.max(100,Math.abs(calc)*.02))diffs.push('評価損益と概算が不一致（諸費用等も確認）');}return diffs;}
 function reconcileMargin(m){let e=[];if([m.cash,m.collateral,m.effective].every(x=>Number.isFinite(x))){if(m.effective>m.cash+m.collateral+1)e.push('実質保証金が現金＋代用評価額を超過');}if(m.principal>0&&m.effective>=0&&Number.isFinite(m.rate)){let r=m.effective/m.principal*100;if(Math.abs(r-m.rate)>.15)e.push('維持率とA/B計算が一致しない');}return e;}
 return {numeric,parseCodes,valueAfter,parseMargin,validatePosition,reconcile,reconcileMargin};
})();if(typeof module!=='undefined')module.exports=ImportCore;
