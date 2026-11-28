'use strict';
/* Lot-safe import planning. Pure code: no account data leaves the device. */
const LotCore=(()=>{
 const code=p=>String(p.code||String(p.name||'').match(/\[([0-9]{4}|[0-9]{3}[A-Z])\]/)?.[1]||'').toUpperCase();
 const lot=p=>String(p.lotKey||'').trim().normalize('NFKC');
 const key=p=>[p.account,code(p),p.kind].join('|');
 function plan(existing,incoming){
  if(!Array.isArray(existing)||!Array.isArray(incoming))throw Error('建玉形式が不正です');
  const operations=[],issues=[],seen=new Set();
  for(const item of incoming){
   const id=key(item),lotKey=lot(item);
   if(!item.account||!code(item)||!['long','short','cash'].includes(item.kind)){
    issues.push({item,reason:'口座・銘柄コード・区分を確認'});continue;
   }
   const candidateKey=id+'|'+(lotKey||'(aggregate)');
   if(seen.has(candidateKey)){issues.push({item,reason:'同じ取り込み内で重複した建玉'});continue;}seen.add(candidateKey);
   const matches=existing.filter(x=>key(x)===id);
   if(lotKey){
    const exact=matches.filter(x=>lot(x)===lotKey);
    if(exact.length===1)operations.push({type:'update',item,targetId:exact[0].id});
    else if(exact.length>1)issues.push({item,reason:'同じ明細IDが既存データに複数あります'});
    else if(matches.some(x=>!lot(x)))issues.push({item,reason:'同銘柄の集約建玉が既存にあります。二重計上回避のため保留'});
    else operations.push({type:'insert',item});
   }else if(matches.length===0)operations.push({type:'insert',item});
   else if(matches.length===1&&!lot(matches[0]))operations.push({type:'update',item,targetId:matches[0].id});
   else issues.push({item,reason:'同銘柄に複数明細があります。建日・明細IDを指定してください'});
  }
  return {operations,issues};
 }
 return {plan,code,lot};
})();
if(typeof module!=='undefined')module.exports=LotCore;
