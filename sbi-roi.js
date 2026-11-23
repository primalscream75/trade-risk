'use strict';
/* SBI mobile account list: anchored OCR of cells, not arbitrary 4-character strings.
   Geometry is relative to the full iPhone portrait screenshot. Never auto-save. */
const SbiRoi=(()=>{
 const R={header:[0.01,.222,.98,.080],count:[.79,.195,.20,.045],left:[.005,.303,.363,.064],middle:[.375,.303,.301,.064],right:[.684,.303,.310,.064]};
 const toNumeric=s=>String(s||'').replace(/[，]/g,',').replace(/[．]/g,'.').replace(/[－−―]/g,'-').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248));
 function tokens(text){const t=toNumeric(text);return [...t.matchAll(/(?<![A-Za-z0-9])[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?/g)].map(m=>({value:Number(m[0].replace(/,/g,'')),text:m[0],offset:m.index})).filter(x=>Number.isFinite(x.value));}
 function identify(left){const t=String(left||'').normalize('NFKC').toUpperCase().replace(/[\s　]/g,'');const c=t.match(/(?<![A-Z0-9])(?:\d{4}|\d{3}[A-Z])(?=$|[^A-Z0-9])/g)||[];
  const direct=c.find(x=>x==='5803'||x==='581A'||x==='285A'||x==='4186'||x==='6777'||x==='6787'||x==='7013'||x==='7011');
  if(direct)return {code:direct,evidence:'code',kind:/売建|売り/.test(left)?'short':/現物|NISA/.test(left)?'cash':'long'};
  if(/フジクラ|フジク[ラフ]/.test(t))return {code:'5803',evidence:'name-correction',kind:/売建/.test(left)?'short':'long'};
  // GO is short; require additional position marker or an attempted matching symbol code.
  if(/(?:^|[^A-Z])GO(?:$|[^A-Z])/.test(t)&&(/買建|売建/.test(t)))return {code:'581A',evidence:'name-correction',kind:/売建/.test(left)?'short':'long'};
  return null;
 }
 function parseCell(view,left,middle,right){let anchor=identify(left);if(!anchor)return null;let r={...anchor};let mid=tokens(middle),rightNums=tokens(right);
  if(view==='price'){
   const positives=mid.filter(x=>x.value>0&&x.value<1000000);
   if(positives.length>=2){r.current=positives[0].value;r.entry=positives[1].value;}
   else r.warnings=['現在値・建単価は判定不能'];
   let pn=rightNums.find(x=>x.value<0&&Math.abs(x.value)>=1000);if(pn)r.pnl=pn.value;
  }else if(view==='quantity'){
   const q=mid.find(x=>Number.isInteger(x.value)&&x.value>=1&&x.value<100000000);
   if(q)r.qty=q.value;
   let mv=rightNums.find(x=>x.value>=1000);if(mv)r.marketValue=mv.value;
  }
  return r;
 }
 function detectView(header,right){let t=String(header||'');if(/建株数|注文数|評価額前日比/.test(t))return 'quantity';if(/現在値|平均建単価|評価損益率/.test(t))return 'price';
  let nums=tokens(right),pos=nums.find(x=>x.value>0);return pos&&pos.value>=100000?'quantity':nums.find(x=>x.value<0&&Math.abs(x.value)>=1000)?'price':null;
 }
 function region(name,row=0,side='price'){
  if(!R[name])throw Error('Unknown region');let [x,y,w,h]=R[name];if(['left','middle','right'].includes(name))y+=row*.067;
  if(name==='middle'&&side==='quantity'){w=.246;}
  if(name==='right'&&side==='quantity'){x=.621;w=.374;}
  return {x,y,w,h};
 }
 function cleanCell(text){return String(text||'').replace(/[　\r]/g,' ').trim();}
 function mergeStructured(images){const grouped=new Map();let warnings=[];for(const im of images){for(const row of im.rows||[]){let c=parseCell(im.view,row.left,row.middle,row.right);if(!c){if(row.left.trim())warnings.push(`${im.name||'画像'}: 識別できない銘柄行がありました`);continue;}
    let key=c.code+'|'+c.kind;if(!grouped.has(key))grouped.set(key,{code:c.code,kind:c.kind,sources:[],conflicts:[],warnings:[]});let p=grouped.get(key);p.sources.push(im.name||'画像');if(c.evidence==='name-correction')p.warnings.push('銘柄名からコードを補正（要確認）');
    for(const k of ['qty','entry','current','marketValue','pnl'])if(c[k]!==undefined){if(p[k]!==undefined&&p[k]!==c[k]){p.conflicts.push(k);delete p[k];}else if(!p.conflicts.includes(k))p[k]=c[k];}
   }}let positions=[...grouped.values()].map(p=>{
  // A displayed market value and exact share count determine the marked price.
  // Keep it visibly flagged as calculated, never claim OCR recognized the price.
  if(p.qty>0 && p.marketValue>0 && p.current===undefined && !p.conflicts.includes('current')){
   const inferred=p.marketValue/p.qty;
   if(Number.isFinite(inferred)&&inferred>0&&inferred<1000000){
    p.current=Math.round(inferred*10000)/10000;
    p.warnings.push('現在値はOCRではなく評価額÷株数で算出（要確認）');
   }
  }
  if(p.qty&&p.current&&p.marketValue&&Math.abs(p.qty*p.current-p.marketValue)>Math.max(2,p.marketValue*.002))p.conflicts.push('評価額');p.conflicts=[...new Set(p.conflicts)];p.warnings=[...new Set(p.warnings)];return p;});return {positions,warnings};}
 return {tokens,identify,parseCell,detectView,region,mergeStructured,cleanCell};
})();if(typeof module!=='undefined')module.exports=SbiRoi;
