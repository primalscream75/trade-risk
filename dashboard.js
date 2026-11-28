'use strict';
(()=>{
 const get=id=>document.getElementById(id),fmt=n=>Math.round(n).toLocaleString('ja-JP')+'円',pct=n=>Number.isFinite(n)?n.toFixed(2)+'%':'未判定';
 const el=(tag,txt='',cls='')=>{const e=document.createElement(tag);e.textContent=txt;e.className=cls;return e;};
 const metric=(parent,label,value,bad=false)=>{let d=el('div','','metric');d.append(el('span',label),el('b',value,bad?'warn':''));parent.append(d);};
 const note=(parent,text)=>parent.append(el('p',text,'note'));
 const when=stamp=>stamp?new Date(stamp).toLocaleString('ja-JP'):'更新時刻の記録なし';
 function render(){const state=window.TradeRiskPortfolio?.snapshot?.();if(!state)return;const choice=get('dashboardScope'),old=choice.value;choice.replaceChildren();const all=el('option','4口座など全口座合算');all.value='all';choice.append(all);for(const a of state.accounts){const x=el('option',a.name);x.value=a.id;choice.append(x);}choice.value=[...choice.options].some(o=>o.value===old)?old:'all';const selected=choice.value==='all'?state.accounts:state.accounts.filter(a=>a.id===choice.value);
 const result=RiskDashboard.calculate(selected,choice.value==='all'?state.positions:state.positions.filter(p=>selected.some(a=>a.id===p.account)),Number(get('dashboardShock').value),Number(get('dashboardCollateralShock').value));
 const summary=get('dashboardTotals'),accountList=get('dashboardAccounts'),themes=get('dashboardThemes'),alerts=get('dashboardAlerts');[summary,accountList,themes,alerts].forEach(x=>x.replaceChildren());
 if(!selected.length){note(summary,'口座・建玉から口座を登録してください。');return;}
 metric(summary,'登録口座数 / 建玉数',selected.length+'口座 / '+result.positionCount+'件');metric(summary,'登録純資産合計',fmt(result.totalEquity));metric(summary,'建玉時価合計（売りも絶対額）',fmt(result.totalGross));metric(summary,'信用建玉時価合計',fmt(result.totalCredit));
 metric(summary,'撤退リスク合計',result.riskComplete?fmt(result.totalRisk):fmt(result.totalRisk)+'（一部のみ）',!result.riskComplete);metric(summary,'撤退リスク / 純資産',result.riskComplete&&result.hasAssets?pct(result.totalRisk/result.totalEquity*100):'未判定',!result.riskComplete);
 metric(summary,'同時逆行の追加損失試算',fmt(result.totalStress),true);metric(summary,'同時逆行 / 純資産',result.hasAssets?pct(result.totalStress/result.totalEquity*100):'未判定');
 if(!result.riskComplete)note(alerts,`撤退リスクは確定できません：撤退価格未設定 ${result.missing}件、撤退価格突破・方向不整合 ${result.breached}件、入力不正 ${result.invalid}件、口座未紐付け ${result.unmatched}件。`);
 if(result.marginUnknown)note(alerts,`信用維持率の試算ができない口座：${result.marginUnknown}件。建代金・保証金情報を確認してください。`);
 note(alerts,'画像OCRによる数値は未確認のことがあります。表示は登録データの静的試算であり、現在のSBI口座残高や追証判定を保証しません。');
 note(alerts,'全建玉が同じ割合だけ不利に変動する仮定（買いは下落・売りは上昇）。売買・手数料・担保掛目の変化・約定不能・市場連動性は反映しません。代用株式が建玉にも含まれると影響を重複して見る可能性があります。');
 for(const a of result.byAccount){let c=el('div','','result');c.append(el('h3',a.name));metric(c,'純資産 / 建玉時価',fmt(a.equity)+' / '+fmt(a.gross));metric(c,'信用時価 / 建玉件数',fmt(a.credit)+' / '+a.positionCount+'件');metric(c,'撤退リスク',a.missing+a.breached+a.invalid?fmt(a.risk)+'（未判定あり）':fmt(a.risk),!!(a.missing+a.breached+a.invalid));metric(c,'口座損失予算',a.equity>0&&a.limit>0?fmt(a.equity*a.limit/100):'未設定');metric(c,'口座リスク予算超過',a.missing+a.breached+a.invalid?'未判定':(a.risk>a.equity*a.limit/100?'超過':'超過なし'),!!(a.missing+a.breached+a.invalid||a.risk>a.equity*a.limit/100));metric(c,'同時逆行の追加損失',fmt(a.stress));if(a.margin?.valid){metric(c,'現在維持率（登録値）',pct(a.margin.before));metric(c,'逆行＋担保下落後（概算）',pct(a.margin.after),a.margin.after<a.margin.threshold);metric(c,'追証基準までの余裕（現在）',fmt(a.margin.buffer),a.margin.buffer<=0);metric(c,'試算後の基準不足金',fmt(a.margin.shortfall),a.margin.shortfall>0);}else if(a.margin)note(c,'維持率は未判定：'+a.margin.reason);note(c,'口座更新日時：'+when(a.updatedAt));accountList.append(c);}
 for(const t of result.themes){let c=el('div','','result');c.append(el('h3',t.name));metric(c,'建玉時価 / 件数',fmt(t.gross)+' / '+t.count+'件');metric(c,'全建玉に占める割合',result.totalGross?pct(t.gross/result.totalGross*100):'未判定');metric(c,'撤退リスク',t.missing+t.breached?fmt(t.risk)+'（未判定あり）':fmt(t.risk),!!(t.missing+t.breached));metric(c,'同時逆行試算',fmt(t.stress));themes.append(c);}
 }
 get('dashboardScope').addEventListener('change',render);for(const id of ['dashboardShock','dashboardCollateralShock'])get(id).addEventListener('input',render);
 document.addEventListener('trade-risk-portfolio-change',render);window.TradeRiskDashboard={render};render();
})();
