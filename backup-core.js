'use strict';
/* Portable backup and conservative validation; no network calls. */
const BackupCore=(()=>{
 const PORTFOLIO_KEY='trade-risk-portfolio-v1';
 const SETTINGS_KEY='trade-risk-settings-v1';
 function check(s){
  if(!s||typeof s!=='object'||Array.isArray(s))throw Error('バックアップ形式が不正です');
  if(s.format!=='trade-risk-backup'||s.version!==1)throw Error('対応していないバックアップ形式です');
  const p=s.portfolio;
  if(!p||!Array.isArray(p.accounts)||!Array.isArray(p.positions))throw Error('口座・建玉情報の形式が不正です');
  if(p.accounts.length>100||p.positions.length>10000)throw Error('データ件数が上限を超えています');
  const ids=new Set();
  for(const a of p.accounts){if(!a||typeof a.id!=='string'||typeof a.name!=='string'||a.name.length>100||ids.has(a.id))throw Error('口座ID・名称が不正です');ids.add(a.id);}
  for(const x of p.positions){if(!x||typeof x!=='object'||!ids.has(x.account)||!['cash','long','short'].includes(x.kind)||!Number.isFinite(Number(x.entry))||Number(x.entry)<=0||!Number.isFinite(Number(x.current))||Number(x.current)<=0||!Number.isInteger(Number(x.qty))||Number(x.qty)<=0)throw Error('建玉内容が不正です');}
  if(s.settings!==null&&(typeof s.settings!=='object'||Array.isArray(s.settings)))throw Error('基本設定が不正です');
  return {accounts:p.accounts.length,positions:p.positions.length};
 }
 function make(portfolio,settings){const obj={format:'trade-risk-backup',version:1,exportedAt:new Date().toISOString(),portfolio:portfolio||{accounts:[],positions:[]},settings:settings||null};check(obj);return obj;}
 return {PORTFOLIO_KEY,SETTINGS_KEY,check,make};
})();if(typeof module!=='undefined')module.exports=BackupCore;
