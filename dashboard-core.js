'use strict';
/* Pure calculations. No persisted data is changed. */
const RiskDashboard = (() => {
  const finitePositive=x=>Number.isFinite(x)&&x>0;
  function calculate(accounts,positions,shock=10,collateralShock=10){
    if(!Array.isArray(accounts)||!Array.isArray(positions)||!Number.isFinite(shock)||shock<0||shock>99||!Number.isFinite(collateralShock)||collateralShock<0||collateralShock>100)throw Error('試算条件が不正です');
    let totalEquity=0,totalGross=0,totalCredit=0,totalRisk=0,totalStress=0,totalCreditStress=0,missing=0,breached=0,invalid=0,unmatched=0,marginEligible=0,marginUnknown=0;
    const byAccount=[],themeMap=new Map(),accountIds=new Set(accounts.map(a=>a.id));
    for(const p of positions)if(!accountIds.has(p.account))unmatched++;
    for(const a of accounts){
      const equity=Number(a.equity),limit=Number(a.limit),themeLimit=Number(a.themeLimit),subset=positions.filter(p=>p.account===a.id);
      const row={id:a.id,name:String(a.name||'無名口座'),equity:finitePositive(equity)?equity:0,gross:0,credit:0,risk:0,stress:0,creditStress:0,missing:0,breached:0,invalid:0,limit,themeLimit,margin:null,positionCount:subset.length,updatedAt:a.updatedAt||null};
      totalEquity+=row.equity;
      let creditPrincipal=0;
      for(const p of subset){
        const qty=Number(p.qty),entry=Number(p.entry),current=Number(p.current),stop=Number(p.stop),kind=p.kind;
        if(!finitePositive(qty)||!Number.isInteger(qty)||!finitePositive(entry)||!finitePositive(current)||!['cash','long','short'].includes(kind)){invalid++;row.invalid++;continue;}
        const val=qty*current,credit=kind!=='cash',loss=val*shock/100; if(p.updatedAt&&(!row.updatedAt||p.updatedAt>row.updatedAt))row.updatedAt=p.updatedAt;
        row.gross+=val;row.stress+=loss;totalGross+=val;totalStress+=loss;
        if(credit){row.credit+=val;row.creditStress+=loss;totalCredit+=val;totalCreditStress+=loss;creditPrincipal+=entry*qty;}
        const theme=String(p.theme||'未分類').trim()||'未分類';
        if(!themeMap.has(theme))themeMap.set(theme,{name:theme,gross:0,risk:0,missing:0,breached:0,count:0,stress:0});
        const t=themeMap.get(theme); t.gross+=val;t.count++;t.stress+=loss;
        const sign=kind==='short'?-1:1;
        if(!finitePositive(stop)){missing++;row.missing++;t.missing++;continue;}
        const distance=(current-stop)*sign;
        if(!(distance>0)){breached++;row.breached++;t.breached++;continue;}
        const risk=distance*qty;row.risk+=risk;totalRisk+=risk;t.risk+=risk;
      }
      const m=a.margin;
      if(m&&finitePositive(Number(m.principal))&&Number.isFinite(Number(m.effective))&&Number(m.collateral)>=0&&Number(m.threshold)>0&&Number(m.threshold)<=100){
        const principal=Number(m.principal),effective=Number(m.effective),collateral=Number(m.collateral),threshold=Number(m.threshold);
        const matched=Math.abs(principal-creditPrincipal)<=Math.max(1,principal*0.001)&&row.invalid===0;
        if(matched){
          const stressed=effective-row.creditStress-collateral*collateralShock/100;
          row.margin={valid:true,before:effective/principal*100,after:stressed/principal*100,threshold,buffer:effective-principal*threshold/100,shortfall:Math.max(0,principal*threshold/100-stressed)};
          marginEligible++;
        }else{row.margin={valid:false,reason:'登録信用建玉の建代金が保証金画面と一致しません'};marginUnknown++;}
      }else if(row.credit>0){row.margin={valid:false,reason:'保証金情報が未登録または不正です'};marginUnknown++;}
      byAccount.push(row);
    }
    const themes=[...themeMap.values()].sort((a,b)=>b.gross-a.gross);
    return {totalEquity,totalGross,totalCredit,totalRisk,totalStress,totalCreditStress,missing,breached,invalid,unmatched,marginEligible,marginUnknown,byAccount,themes,positionCount:byAccount.reduce((n,a)=>n+a.positionCount,0),riskComplete:missing+breached+invalid+unmatched===0,hasAssets:totalEquity>0,shock,collateralShock};
  }
  return {calculate};
})();
if(typeof module!=='undefined')module.exports=RiskDashboard;
