'use strict';
(()=>{
 const $=id=>document.getElementById(id), status=$('backupStatus');
 function inform(s){status.textContent=s;}
 function getData(){const raw=localStorage.getItem(BackupCore.PORTFOLIO_KEY);let p=raw?JSON.parse(raw):{accounts:[],positions:[]};const settingsRaw=localStorage.getItem('trade-risk-v01');let settings=settingsRaw?JSON.parse(settingsRaw):null;return BackupCore.make(p,settings);}
 $('backupExport').onclick=()=>{
  try{const b=getData(),blob=new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='trade-risk-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);inform('バックアップを生成しました。iPhoneの「ファイル」に保存されたか確認してください。');}
  catch(e){inform('バックアップできません：'+e.message);}
 };
 $('backupImport').onclick=async()=>{
  const f=$('backupFile').files?.[0];if(!f){inform('先にバックアップJSONを選んでください。');return;}
  if(f.size>8*1024*1024){inform('ファイルが大きすぎます（最大8MB）。');return;}
  try{let raw=await f.text(),b=JSON.parse(raw),n=BackupCore.check(b),current=getData();
   if(!confirm(`バックアップ：口座${n.accounts}件・建玉${n.positions}件を復元します。現在の口座・建玉情報は置き換わります。続行しますか？`))return;
   // Stage rollback in memory; restore if writing either key fails.
   const oldPortfolio=localStorage.getItem(BackupCore.PORTFOLIO_KEY),oldSettings=localStorage.getItem('trade-risk-v01');
   try{localStorage.setItem(BackupCore.PORTFOLIO_KEY,JSON.stringify(b.portfolio));if(b.settings!==null)localStorage.setItem('trade-risk-v01',JSON.stringify(b.settings));}
   catch(e){if(oldPortfolio===null)localStorage.removeItem(BackupCore.PORTFOLIO_KEY);else localStorage.setItem(BackupCore.PORTFOLIO_KEY,oldPortfolio);if(oldSettings===null)localStorage.removeItem('trade-risk-v01');else localStorage.setItem('trade-risk-v01',oldSettings);throw e;}
   inform('復元しました。画面を再読み込みします。');location.reload();
  }catch(e){inform('復元できません：'+e.message);}
 };
})();
