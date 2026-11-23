'use strict';
/* SBI mobile screenshot layout parser. Advisory only: missing or ambiguous OCR values remain blank. */
const SbiParser=(()=>{
 const codeRe=/(?:^|[^A-Z0-9])([0-9]{4}|[0-9]{3}[A-Z])(?=$|[^A-Z0-9])/g;
 const normalize=t=>String(t||'').replace(/\r/g,'').replace(/，/g,',').replace(/[－−―]/g,'-').replace(/　/g,' ').replace(/（/g,'(').replace(/）/g,')');
 const numbers=t=>[...normalize(t).matchAll(/(?<![A-Z0-9])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?:\s*(円|株|%))?/g)].map(m=>({n:Number(m[1].replace(/,/g,'')),unit:m[2]||'',raw:m[0]})).filter(x=>Number.isFinite(x.n));
 const cleanCode=x=>String(x||'').toUpperCase();
 function classify(text){let t=normalize(text);if(/委託保証金|建代金合計|信用建余力/.test(t))return 'margin';if(/建株数|注文数|評価額前日比/.test(t))return 'quantity';if(/現在値|平均建単価|評価損益率/.test(t))return 'price';return 'unknown';}
 function parseRows(text,view){
  const lines=normalize(text).split(/\n/).map(s=>s.trim()).filter(Boolean),starts=[];
  for(let i=0;i<lines.length;i++){
   // Most SBI rows show 5803 買建/特定 or code alone beneath the name.
   let matches=[...lines[i].toUpperCase().matchAll(codeRe)].map(m=>m[1]);
   if(!matches.length)continue;
   if(!/買建|売建|特定|一般|NISA|現物|保有/.test(lines[i]) && !/^\d{4}$|^\d{3}[A-Z]$/.test(lines[i].toUpperCase()))continue;
   for(let code of matches)starts.push({i,code});
  }
  const out=[];
  for(let k=0;k<starts.length;k++){
   let {i,code}=starts[k],end=starts[k+1]?.i??lines.length;
   let content=lines.slice(i,end),above=i>0?lines[i-1]:'';
   let raw=content.join('\n'),vals=numbers(raw),result={code,sourceView:view,kind:/売建/.test(raw)?'short':/現物|NISA/.test(raw)?'cash':'long',name:above};
   // Explicit labels win. We never infer a value from an unlabeled number if several candidates compete.
   const labeled=(label,unit)=>{
    let re=new RegExp(label+'\\s*[:：]?\\s*(-?[\\d,]+(?:\\.\\d+)?)\\s*'+(unit||''),'i'),m=raw.match(re);
    return m?Number(m[1].replace(/,/g,'')):null;
   };
   if(view==='quantity'||view==='unknown'){
    let q=labeled('建株数|保有株数|株数','株?');
    if(q===null){let count=vals.filter(v=>v.unit==='株'&&v.n>0&&Number.isInteger(v.n));if(count.length===1)q=count[0].n;}
    if(q!==null)result.qty=q;
    let mv=labeled('評価額','円?');if(mv===null){let v=vals.filter(x=>x.unit==='円'&&x.n>=10000);if(v.length===1)mv=v[0].n;}
    if(mv!==null)result.marketValue=mv;
   }
   if(view==='price'||view==='unknown'){
    let current=labeled('現在値','円?'),entry=labeled('平均建単価|取得単価','円?');
    // The SBI price view has two positive prices, current first and entry second.
    if(current===null&&entry===null&&view==='price'){
     let v=vals.filter(x=>x.unit==='円'&&x.n>0&&x.n<1000000);
     if(v.length>=2){current=v[0].n;entry=v[1].n;}
    }
    if(current!==null)result.current=current;if(entry!==null)result.entry=entry;
    let pnl=labeled('評価損益','円?');if(pnl===null){let v=vals.filter(x=>x.unit==='円'&&x.n<0);if(v.length===1)pnl=v[0].n;}
    if(pnl!==null)result.pnl=pnl;
   }
   out.push(result);
  }
  return out;
 }
 function mergeImages(images){
  const grouped=new Map(), warnings=[];
  for(let im of images){let view=im.view||classify(im.text);if(view==='margin')continue;let rows=parseRows(im.text,view);for(let row of rows){let key=row.code+'|'+row.kind;if(!grouped.has(key))grouped.set(key,{code:row.code,kind:row.kind,sources:[],conflicts:[]});let p=grouped.get(key);p.sources.push(im.name||view);
    for(let [field,v] of Object.entries(row)){if(['code','kind','sourceView','sources','conflicts'].includes(field)||v===undefined||v===null||v==='')continue;if(p[field]!==undefined&&String(p[field])!==String(v)){p.conflicts.push(field);delete p[field];}else if(!p.conflicts.includes(field))p[field]=v;}
   }
  }
  const result=[...grouped.values()].map(p=>{
   if(p.qty&&p.current&&p.marketValue){let estimate=p.qty*p.current;if(Math.abs(estimate-p.marketValue)>Math.max(1,estimate*.002))p.conflicts.push('評価額');}
   if(p.qty&&p.current&&p.entry&&Number.isFinite(p.pnl)){let expected=(p.current-p.entry)*p.qty*(p.kind==='short'?-1:1);if(Math.abs(expected-p.pnl)>Math.max(100,Math.abs(expected)*.02))p.warnings=['評価損益に差異（諸費用・建日別内訳を確認）'];}
   p.conflicts=[...new Set(p.conflicts)];return p;
  });
  if(!result.length)warnings.push('銘柄行を検出できませんでした。OCRテキストを確認してください');
  return {positions:result,warnings};
 }
 return {classify,parseRows,mergeImages,numbers};
})();if(typeof module!=='undefined')module.exports=SbiParser;
