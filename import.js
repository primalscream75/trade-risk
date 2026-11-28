'use strict';
(()=>{
const $=id=>document.getElementById(id), info=$('importInfo'), files=$('importFiles'), rows=$('importRows'), marginBox=$('importMargin'), assignmentBox=$('importFileAssignments'), state={draft:[],marginByAccount:{},images:[],accountList:[],assignments:[]};
const catalog={"5803":{name:'フジクラ',theme:'AI・データセンター・光通信'},"581A":{name:'GO',theme:'モビリティ'},"285A":{name:'キオクシアHD',theme:'半導体・メモリ'},"4186":{name:'東京応化工業',theme:'半導体材料'},"6777":{name:'santec Holdings',theme:'光通信・データセンター'},"6787":{name:'メイコー',theme:'電子部品・AI'},"7013":{name:'IHI',theme:'防衛・航空宇宙'},"7011":{name:'三菱重工業',theme:'防衛・重工'}};
function p(t){info.textContent=t;}
function cell(row,label,value,type='text'){let wrap=document.createElement('label');wrap.textContent=label;let inp=document.createElement('input');inp.type=type;inp.value=value??'';inp.dataset.key=label;wrap.append(inp);row.append(wrap);return inp;}
function select(row,label,choices,value){let l=document.createElement('label');l.textContent=label;let x=document.createElement('select');x.dataset.key=label;for(let [v,t] of choices){let o=document.createElement('option');o.value=v;o.textContent=t;x.append(o);}x.value=value;l.append(x);row.append(l);return x;}
function makeDraft(code,source,account=''){let db=catalog[code]||{};return {code,name:db.name||'',theme:db.theme||'未分類',kind:'long',qty:'',entry:'',current:'',marketValue:'',pnl:'',lotKey:'',source,account,conflicts:[]};}
function parseAll(texts){
 const valid=state.accountList.map(a=>a.id),partition=BatchCore.split(texts,valid);
 if(partition.errors.length)throw Error(partition.errors.join(' / '));
 const all=[];
 for(const [account,part] of partition.groups){
  const structured=part.filter(x=>Array.isArray(x.rows));
  const merged=structured.length?SbiRoi.mergeStructured(structured):SbiParser.mergeImages(part),index=new Map();
  for(const r of merged.positions){
   if(!catalog[r.code])continue; // only verified local catalog may create OCR candidates
   const d=makeDraft(r.code,(r.sources||[]).join(', '),account);
   for(const k of ['kind','qty','entry','current','marketValue','pnl'])if(r[k]!==undefined)d[k]=r[k];
   d.conflicts=r.conflicts||[];d.warnings=r.warnings||[];
   index.set(r.code+'|'+r.kind,d);
  }
  all.push(...index.values());
 }
 return all;
}
function renderAssignments(){
 assignmentBox.replaceChildren();
 let chosen=[...files.files];
 if(!chosen.length){assignmentBox.textContent='画像を選択すると、画像ごとの口座指定が表示されます。';return;}
 if(!state.accountList.length){assignmentBox.textContent='先に「口座・建玉」から口座を登録してください。';return;}
 let title=document.createElement('strong');title.textContent='画像ごとの登録先口座（同一口座の複数画像には同じ口座を選択）';assignmentBox.append(title);
 let prior=state.assignments;
 state.assignments=chosen.map((f,i)=>({name:f.name,account:prior[i]?.name===f.name?prior[i].account:($('importAccount').value||state.accountList[0].id)}));
 chosen.forEach((f,i)=>{
  let label=document.createElement('label');label.textContent=`${i+1}. ${f.name} → `;
  const selectEl=document.createElement('select');selectEl.setAttribute('aria-label',f.name+'の登録先口座');
  for(const a of state.accountList){let opt=document.createElement('option');opt.value=a.id;opt.textContent=a.name;selectEl.append(opt);}
  selectEl.value=state.assignments[i].account;
  selectEl.onchange=()=>state.assignments[i].account=selectEl.value;
  label.append(selectEl);assignmentBox.append(label);
 });
}
files.addEventListener('change',renderAssignments);
function show(){rows.replaceChildren();$('importCount').textContent=state.draft.length+'件（未確定）';state.draft.forEach((d,i)=>{let box=document.createElement('div');box.className='result importrow';let h=document.createElement('strong');h.textContent='未確定候補 '+(i+1)+'：'+(d.code||'コード未判定');box.append(h);let grid=document.createElement('div');grid.className='pair';let fields={};fields.account=select(grid,'登録先口座',state.accountList.map(a=>[a.id,a.name]),d.account||$('importAccount').value);fields.code=cell(grid,'コード',d.code);fields.name=cell(grid,'名称',d.name);fields.theme=cell(grid,'テーマ',d.theme);fields.lotKey=cell(grid,'建日・明細ID（複数建玉のとき任意）',d.lotKey);fields.kind=select(grid,'区分',[['long','信用買い'],['short','信用売り'],['cash','現物']],d.kind);fields.qty=cell(grid,'株数',d.qty,'number');fields.entry=cell(grid,'建単価',d.entry,'number');fields.current=cell(grid,'現在値',d.current,'number');fields.marketValue=cell(grid,'評価額（照合用・任意）',d.marketValue,'number');fields.pnl=cell(grid,'評価損益（照合用・任意）',d.pnl,'number');box.append(grid);for(const key of ['qty','entry','current']){if(fields[key].value===''||!(Number(fields[key].value)>0)){fields[key].style.border='2px solid #ca6a29';fields[key].setAttribute('aria-label',fields[key].dataset.key+'（要入力）');fields[key].placeholder='要確認・入力';}}let issues=document.createElement('p');issues.className='note';box.append(issues);function updated(){Object.keys(fields).forEach(k=>d[k]=fields[k].value);let errs=ImportCore.validatePosition(d);let checks=errs.length?[]:ImportCore.reconcile(d);issues.textContent=[(errs.length?'不足する必須項目だけ入力してください。評価損益は空欄でも登録可能です。':'必要項目は揃っています。'),d.warnings?.length?'OCR注意：'+d.warnings.join('・'):'',d.conflicts?.length?'OCR不一致：'+d.conflicts.join('・')+'（値を確認・修正してください）':'',errs.length?'必須確認：'+errs.join('・'):'必須値OK',...checks].filter(Boolean).join(' / ');issues.className='note '+(errs.length||checks.length||d.conflicts?.length?'warn':'');}Object.values(fields).forEach(f=>f.addEventListener('input',()=>{if(d.conflicts?.length){d.conflicts=[];}updated();}));updated();let del=document.createElement('button');del.type='button';del.textContent='候補を除外';del.onclick=()=>{state.draft.splice(i,1);show();};box.append(del);rows.append(box);});
marginBox.replaceChildren();
for(const [accountId,m] of Object.entries(state.marginByAccount)){
 if(!m)continue;
 let title=document.createElement('h3');title.textContent='保証金のOCR参考値：'+(state.accountList.find(a=>a.id===accountId)?.name||'不明口座');marginBox.append(title);
 for(let [k,v] of Object.entries(m)){
  let x=document.createElement('div');x.className='metric';let a=document.createElement('span');a.textContent=({cash:'現金',collateral:'代用評価額',effective:'実質保証金',principal:'建代金',rate:'維持率'}[k]||k);
  let b=document.createElement('b');b.textContent=v===null?'未判定':v.toLocaleString('ja-JP');x.append(a,b);marginBox.append(x);
 }
 const errors=ImportCore.reconcileMargin(m);
 if(errors.length){let x=document.createElement('p');x.className='warn';x.textContent=errors.join('・');marginBox.append(x);}
}
if(Object.keys(state.marginByAccount).length){let note=document.createElement('p');note.className='note';note.textContent='保証金OCRは確認用で自動保存しません。実際の追証判定はSBI証券で確認してください。';marginBox.append(note);}
}
async function loadOCR(){if(window.Tesseract)return window.Tesseract;const src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';p('OCRエンジンを取得しています。初回のみ通信が必要です。');await new Promise((ok,fail)=>{let s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>fail(Error('OCRエンジン取得失敗。通信環境を確認してください。'));document.head.append(s);});if(!window.Tesseract)throw Error('OCRエンジンが起動しません');return window.Tesseract;}
async function recognize(){
 let selected=[...files.files];if(!selected.length){p('先に画像を選択してください。');return;}
 if(selected.length>15){p('一度に15枚までにしてください。');return;}
 if(!state.accountList.length){p('先に口座を登録してください。');return;}
 if(state.assignments.length!==selected.length||state.assignments.some(x=>!state.accountList.some(a=>a.id===x.account))){p('画像ごとの登録先口座を確認してください。');return;}
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
    record.account=state.assignments[i]?.account;results.push(record);
   }catch(e){warnings.push(`${f.name}：${e.message}`);}
  }
  state.images=results;state.draft=parseAll(results);
  // Margin screen uses separate labeled text extraction; no speculative positions.
  state.marginByAccount={};
  for(const accountId of state.accountList.map(a=>a.id)){
   const marginText=results.filter(x=>x.view==='margin'&&x.account===accountId).map(x=>x.text||'').join('\n');
   if(!marginText)continue;
   const parsed=ImportCore.parseMargin(marginText);
   if(Object.values(parsed).some(v=>v!==null))state.marginByAccount[accountId]=parsed;
  }
  show();
  const missing=state.draft.flatMap(d=>['qty','entry','current'].filter(k=>!(Number(d[k])>0)).map(k=>d.name+'の'+({qty:'株数',entry:'建単価',current:'現在値'}[k])));
  $('ocrText').value=results.map(x=>`===== ${x.name} / ${x.view} =====\n${x.header}\n${x.text||''}\n${x.rows.map(r=>[r.left,r.middle,r.right].join(' | ')).join('\n')}`).join('\n\n');
  p(`読み取り完了：${results.length}枚、候補${state.draft.length}件。${missing.length?'補完が必要：'+missing.join('、')+'。':'必須入力は揃いました。'} ${warnings.join(' / ')} 評価損益は照合用の任意項目です。元画像と必ず照合してください。`);
 }catch(e){p('OCR失敗：'+e.message+'。画像は外部送信していません。');}
 finally{if(worker)try{await worker.terminate();}catch(e){}btn.disabled=false;}
}
$('importScan').onclick=recognize;
$('importParse').onclick=()=>{let raw=$('ocrText').value;state.draft=parseAll([{name:'貼り付けテキスト',text:raw,account:$('importAccount').value}]);let m=ImportCore.parseMargin(raw);state.marginByAccount={};if(Object.values(m).some(v=>v!==null))state.marginByAccount[$('importAccount').value]=m;show();p(state.draft.length ? '既知銘柄の候補を表示しました。すべて確認してから保存してください。' : '安全に識別できる銘柄がありません。誤ったコードは表示せず、手動追加を利用してください。');};
$('importAddRow').onclick=()=>{state.draft.push(makeDraft('','手動追加',$('importAccount').value));show();};
$('importSave').onclick=()=>{
 if(!state.draft.length){p('登録候補がありません。');return;}
 const valid=state.accountList.map(a=>a.id);
 const errors=[...BatchCore.checkDrafts(state.draft,valid),...state.draft.flatMap((x,i)=>[
  ...(catalog[x.code] || x.source==='手動追加' ? [] : ['未検証の銘柄コード（手動確認してください）']),
  ...ImportCore.validatePosition(x),...(x.conflicts?.length?['OCR照合不一致（確認して修正）']:[])
 ].map(e=>`${i+1}行目 ${e}`))];
 const mismatches=state.draft.flatMap((x,i)=>ImportCore.reconcile(x).map(e=>`${i+1}行目 ${e}`));
 if(errors.length){p('保存できません：'+errors.slice(0,6).join(' / '));return;}
 if(mismatches.length&&!confirm('整合性の注意：'+mismatches.join(' / ')+'。確認済みとして続けますか？'))return;
 const accountCounts=new Map();for(const x of state.draft)accountCounts.set(x.account,(accountCounts.get(x.account)||0)+1);
 const detail=[...accountCounts].map(([id,count])=>`${state.accountList.find(a=>a.id===id)?.name||'?'} ${count}件`).join(' / ');
 if(!confirm(`口座別に登録します：${detail}。画像と口座が正しいことを確認しましたか？`))return;
 // Portfolio importer is the single owner of persistence and conflict detection.
 document.dispatchEvent(new CustomEvent('trade-risk-import',{detail:{positions:state.draft.map(x=>({...x}))}}));
 p('口座別の保存処理を実行しました。保留・重複がある場合は保存結果の警告を確認してください。');
};
window.TradeRiskImport={updateAccounts(accounts){state.accountList=accounts.map(a=>({...a}));let s=$('importAccount'),old=s.value;s.replaceChildren();for(let a of accounts){let o=document.createElement('option');o.value=a.id;o.textContent=a.name;s.append(o);}if(accounts.some(a=>a.id===old))s.value=old;renderAssignments();}};
if(window.TradeRiskPortfolio)window.TradeRiskImport.updateAccounts(window.TradeRiskPortfolio.accounts());
})();
