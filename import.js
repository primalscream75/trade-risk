'use strict';
(()=>{
const $=id=>document.getElementById(id), info=$('importInfo'), files=$('importFiles'), rows=$('importRows'), marginBox=$('importMargin'), state={draft:[],margin:null,images:[]};
const catalog={"5803":{name:'フジクラ',theme:'AI・データセンター・光通信'},"581A":{name:'GO',theme:'モビリティ'},"285A":{name:'キオクシアHD',theme:'半導体・メモリ'},"4186":{name:'東京応化工業',theme:'半導体材料'},"6777":{name:'santec Holdings',theme:'光通信・データセンター'},"6787":{name:'メイコー',theme:'電子部品・AI'},"7013":{name:'IHI',theme:'防衛・航空宇宙'},"7011":{name:'三菱重工業',theme:'防衛・重工'}};
function p(t){info.textContent=t;}
function cell(row,label,value,type='text'){let wrap=document.createElement('label');wrap.textContent=label;let inp=document.createElement('input');inp.type=type;inp.value=value??'';inp.dataset.key=label;wrap.append(inp);row.append(wrap);return inp;}
function select(row,label,choices,value){let l=document.createElement('label');l.textContent=label;let x=document.createElement('select');x.dataset.key=label;for(let [v,t] of choices){let o=document.createElement('option');o.value=v;o.textContent=t;x.append(o);}x.value=value;l.append(x);row.append(l);return x;}
function makeDraft(code,source){let db=catalog[code]||{};return {code,name:db.name||'',theme:db.theme||'未分類',kind:'long',qty:'',entry:'',current:'',marketValue:'',pnl:'',source,conflicts:[]};}
function parseAll(texts){
 const structured=texts.filter(x=>Array.isArray(x.rows));
 const merged=structured.length?SbiRoi.mergeStructured(structured):SbiParser.mergeImages(texts), index=new Map();
 for(const r of merged.positions){let d=makeDraft(r.code,(r.sources||[]).join(', '));for(const k of ['kind','qty','entry','current','marketValue','pnl'])if(r[k]!==undefined)d[k]=r[k];d.conflicts=r.conflicts||[];d.warnings=r.warnings||[];index.set(r.code+'|'+r.kind,d);}
 // Safety: never convert unanchored four-digit prices, dates or OCR noise into positions.
 // New symbols not in the small verified catalog are left for manual entry in this trial build.
 for(const [key,d] of [...index]){
   if(!catalog[d.code])index.delete(key);
 }
 return [...index.values()];
}
function show(){rows.replaceChildren();$('importCount').textContent=state.draft.length+'件（未確定）';state.draft.forEach((d,i)=>{let box=document.createElement('div');box.className='result importrow';let h=document.createElement('strong');h.textContent='未確定候補 '+(i+1)+'：'+(d.code||'コード未判定');box.append(h);let grid=document.createElement('div');grid.className='pair';let fields={};fields.code=cell(grid,'コード',d.code);fields.name=cell(grid,'名称',d.name);fields.theme=cell(grid,'テーマ',d.theme);fields.kind=select(grid,'区分',[['long','信用買い'],['short','信用売り'],['cash','現物']],d.kind);fields.qty=cell(grid,'株数',d.qty,'number');fields.entry=cell(grid,'建単価',d.entry,'number');fields.current=cell(grid,'現在値',d.current,'number');fields.marketValue=cell(grid,'評価額（照合用・任意）',d.marketValue,'number');fields.pnl=cell(grid,'評価損益（照合用・任意）',d.pnl,'number');box.append(grid);let issues=document.createElement('p');issues.className='note';box.append(issues);function updated(){Object.keys(fields).forEach(k=>d[k]=fields[k].value);let errs=ImportCore.validatePosition(d);let checks=errs.length?[]:ImportCore.reconcile(d);issues.textContent=[d.warnings?.length?'OCR注意：'+d.warnings.join('・'):'',d.conflicts?.length?'OCR不一致：'+d.conflicts.join('・')+'（値を確認・修正してください）':'',errs.length?'必須確認：'+errs.join('・'):'必須値OK',...checks].filter(Boolean).join(' / ');issues.className='note '+(errs.length||checks.length||d.conflicts?.length?'warn':'');}Object.values(fields).forEach(f=>f.addEventListener('input',()=>{if(d.conflicts?.length){d.conflicts=[];}updated();}));updated();let del=document.createElement('button');del.type='button';del.textContent='候補を除外';del.onclick=()=>{state.draft.splice(i,1);show();};box.append(del);rows.append(box);});
let m=state.margin;marginBox.replaceChildren();if(m){let title=document.createElement('h3');title.textContent='保証金の認識候補（確認用）';marginBox.append(title);for(let [k,v] of Object.entries(m)){let x=document.createElement('div');x.className='metric';let a=document.createElement('span');a.textContent=({cash:'現金',collateral:'代用評価額',effective:'実質保証金',principal:'建代金',rate:'維持率'}[k]||k);let b=document.createElement('b');b.textContent=v===null?'未判定':v.toLocaleString('ja-JP');x.append(a,b);marginBox.append(x);}let errs=ImportCore.reconcileMargin(m);if(errs.length){let x=document.createElement('p');x.className='warn';x.textContent=errs.join('・');marginBox.append(x);}}}
async function loadOCR(){if(window.Tesseract)return window.Tesseract;const src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';p('OCRエンジンを取得しています。初回のみ通信が必要です。');await new Promise((ok,fail)=>{let s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(Error('OCRエンジン取得失敗。通信環境を確認してください。'));document.head.append(s);});if(!window.Tesseract)throw Error('OCRエンジンが起動しません');return window.Tesseract;}
async function recognize(){
 let selected=[...files.files];if(!selected.length){p('先に画像を選択してください。');return;}
 if(selected.length>15){p('一度に15枚までにしてください。');return;}
 const btn=$('importScan');btn.disabled=true;let worker;
 try{
  let T=await loadOCR();p('画像の列別OCRを起動中（初回は日本語辞書を取得します）');
  worker=await T.createWorker('jpn+eng',1,{logger:()=>{}});
  let results=[],warnings=[];
  for(let i=0;i<selected.length;i++){
   let f=selected[i];if(!f.type.startsWith('image/')){warnings.push(f.name+'：画像以外のため除外');continue;}
   p(`${i+1}/${selected.length}枚目：SBIの表を行・列に分けて読み取り中`);
   try{
    let record=await SbiImageOcr.parseFile(f,worker,msg=>p(msg));
    results.push(record);
   }catch(e){warnings.push(`${f.name}：${e.message}`);}
  }
  state.images=results;state.draft=parseAll(results);
  // Margin screen uses separate labeled text extraction; no speculative positions.
  const marginText=results.filter(x=>x.view==='margin').map(x=>x.text||'').join('\n');
  const parsedMargin=ImportCore.parseMargin(marginText);
  state.margin=Object.values(parsedMargin).some(v=>v!==null)?parsedMargin:null;
  show();
  $('ocrText').value=results.map(x=>`===== ${x.name} / ${x.view} =====\n${x.header}\n${x.text||''}\n${x.rows.map(r=>[r.left,r.middle,r.right].join(' | ')).join('\n')}`).join('\n\n');
  p(`読み取り完了：${results.length}枚、候補${state.draft.length}件。${warnings.join(' / ')} ${state.draft.length?'必ず銘柄・株数・価格を照合してから保存してください。':'銘柄行が特定できませんでした。画像は保存せず、OCR結果だけ確認できます。'}`);
 }catch(e){p('OCR失敗：'+e.message+'。画像は外部送信していません。');}
 finally{if(worker)try{await worker.terminate();}catch(e){}btn.disabled=false;}
}
$('importScan').onclick=recognize;
$('importParse').onclick=()=>{let raw=$('ocrText').value;state.draft=parseAll([{name:'貼り付けテキスト',text:raw}]);let m=ImportCore.parseMargin(raw);state.margin=Object.values(m).some(v=>v!==null)?m:null;show();p(state.draft.length ? '既知銘柄の候補を表示しました。すべて確認してから保存してください。' : '安全に識別できる銘柄がありません。誤ったコードは表示せず、手動追加を利用してください。');};
$('importAddRow').onclick=()=>{state.draft.push(makeDraft('','手動追加'));show();};
$('importSave').onclick=()=>{let account=$('importAccount').value;if(!account){p('先に口座を登録・選択してください。');return;}if(!state.draft.length){p('登録候補がありません。');return;}let errors=state.draft.flatMap((x,i)=>[...(catalog[x.code] || x.source==='手動追加' ? [] : ['未検証の銘柄コード（手動確認してください）']),...ImportCore.validatePosition(x),...(x.conflicts?.length?['OCR照合不一致（確認して修正）']:[])].map(e=>`${i+1}行目 ${e}`));let mismatches=state.draft.flatMap((x,i)=>ImportCore.reconcile(x).map(e=>`${i+1}行目 ${e}`));if(errors.length){p('保存できません：'+errors.slice(0,5).join(' / '));return;}if(mismatches.length&&!confirm('整合性の注意：'+mismatches.join(' / ')+'。確認済みとして続けますか？'))return;if(!confirm(`${state.draft.length}件を登録します。既存の同一口座・銘柄コード・取引区分は更新候補として扱います。実行しますか？`))return;let details=state.draft.map(x=>({...x,account}));let ev=new CustomEvent('trade-risk-import',{detail:{positions:details}});document.dispatchEvent(ev);p('建玉保存を依頼しました。口座・建玉タブで内容を再確認してください。');};
window.TradeRiskImport={updateAccounts(accounts){let s=$('importAccount'),old=s.value;s.replaceChildren();for(let a of accounts){let o=document.createElement('option');o.value=a.id;o.textContent=a.name;s.append(o);}if(accounts.some(a=>a.id===old))s.value=old;}};
if(window.TradeRiskPortfolio)window.TradeRiskImport.updateAccounts(window.TradeRiskPortfolio.accounts());
})();
