'use strict';
const Risk={
 validate(...v){if(v.some(x=>!Number.isFinite(x)||x<=0))throw Error('正の数値を入力してください');},
 position(a,r,p,s,t,u,d){this.validate(a,r,p,s,t,u);if(r>100||!Number.isInteger(u))throw Error('設定値を確認してください');let sign=d==='sell'?-1:1,dist=(p-s)*sign,reward=(t-p)*sign;if(dist<=0||reward<=0)throw Error('損切り・利確価格の方向を確認してください');let budget=a*r/100,qty=Math.floor(budget/dist/u)*u;return {budget,qty,loss:qty*dist,value:qty*p,ratio:reward/dist,profit:qty*reward};},
 add(p,q,p2,q2,s,d){this.validate(p,q,p2,q2,s);if(!Number.isInteger(q)||!Number.isInteger(q2))throw Error('株数は整数で入力してください');let total=q+q2,avg=(p*q+p2*q2)/total,loss=(avg-s)*total*(d==='sell'?-1:1);return {total,avg,loss};},
 gap(p,q,g,d){this.validate(p,q,g);if(g>=100||!Number.isInteger(q))throw Error('株数または変動率を確認してください');return {price:p*(1+(d==='sell'?1:-1)*g/100),loss:p*q*g/100};}
};
if(typeof module!=='undefined')module.exports=Risk;
