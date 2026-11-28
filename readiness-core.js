'use strict';
/* No raw account data is exported; this only audits the local snapshot. */
const RiskReadiness=(()=>{
 const time=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
 function audit(accounts,positions,now=Date.now()){
  if(!Array.isArray(accounts)||!Array.isArray(positions))throw Error('データ形式が不正です');
  return {accounts:accounts.map(a=>{
   const own=positions.filter(p=>p.account===a.id),credit=own.filter(p=>p.kind==='long'||p.kind==='short');
   const last=own.reduce((n,p)=>Math.max(n,time(p.updatedAt)||0),0)||null;
   const reconciled=time(a.reconciledAt),marginAt=time(a.marginUpdatedAt);const messages=[];
   if(!own.length)messages.push('建玉が未登録です。0件を保有なしと判定しません。');
   if(!last)messages.push('建玉の更新日時が不明です。');else if(now-last>=86400000)messages.push('建玉更新が24時間以上前です。');
   if(credit.length && (!reconciled || (last&&reconciled<last)))messages.push('信用建玉がSBIの全件と照合されていません。');
   if(credit.length && (!marginAt || now-marginAt>=86400000 || now-marginAt < -300000))messages.push('保証金が24時間以内に入力されていません。');
   if(credit.some(p=>!(Number(p.stop)>0)))messages.push('損切り価格未設定の信用建玉があります。');
   if(own.some(p=>!(Number(p.entry)>0&&Number(p.current)>0&&Number.isInteger(Number(p.qty))&&Number(p.qty)>0)))messages.push('建玉に数値不正があります。');
   return {id:a.id,name:String(a.name||'無名口座'),status:messages.length?'要確認':'登録条件を満たす（最新・完全を保証しません）',messages:messages.length?messages:['入力条件は揃っています。SBI実画面で最新値を再確認してください。']};
  })};
 }
 return {audit};
})();if(typeof module!=='undefined')module.exports=RiskReadiness;
