'use strict';
/* Account-scoped OCR batches: never merge the same symbol across accounts. */
const BatchCore=(()=>{
 const code=r=>String(r.code||'').trim().toUpperCase();
 function split(records, validAccounts){
  if(!Array.isArray(records))throw Error('画像データが不正です');
  const allowed=new Set(validAccounts);
  const groups=new Map(),errors=[];
  for(const record of records){
   if(!record||!allowed.has(record.account)){errors.push('登録先の口座が不明な画像があります');continue;}
   if(!groups.has(record.account))groups.set(record.account,[]);
   groups.get(record.account).push(record);
  }
  return {groups,errors};
 }
 function checkDrafts(drafts,validAccounts){
  const ids=new Set(validAccounts), errors=[];
  for(let i=0;i<drafts.length;i++){
   const d=drafts[i];
   if(!ids.has(d.account))errors.push(`${i+1}行目：登録先口座が不正です`);
   if(!/^([0-9]{4}|[0-9]{3}[A-Z])$/.test(code(d)))errors.push(`${i+1}行目：銘柄コードが不正です`);
  }
  return errors;
 }
 return {split,checkDrafts};
})();
if(typeof module!=='undefined')module.exports=BatchCore;
