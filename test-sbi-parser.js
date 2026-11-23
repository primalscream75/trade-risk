'use strict';const assert=require('node:assert/strict');const S=require('./sbi-parser');
const price=`銘柄 売買/預り 返済期限 現在値 平均建単価 評価損益
銘柄甲
5803 買建/特定
6カ月
2,800円
3,000円
-200,000円
-6.67%
銘柄乙
581A 買建/特定
6カ月
2,500円
2,700円
-400,000円
-7.41%`;
const quantity=`銘柄 建株数(注文数) 評価額 評価額前日比
銘柄甲
5803 買建/特定
6カ月
1,000株
(0)
2,800,000円
-30,000円(-1.06%)
銘柄乙
581A 買建/特定
6カ月
2,000株
(0)
5,000,000円
-50,000円(-0.99%)`;
assert.equal(S.classify(price),'price');assert.equal(S.classify(quantity),'quantity');
let rows=S.mergeImages([{name:'price.png',text:price},{name:'quantity.png',text:quantity}]).positions;
assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.code),['5803','581A']);
assert.equal(rows[0].qty,1000);assert.equal(rows[0].current,2800);assert.equal(rows[0].entry,3000);assert.equal(rows[0].marketValue,2800000);assert.deepEqual(rows[0].conflicts,[]);
assert.equal(rows[1].qty,2000);assert.equal(rows[1].entry,2700);assert.equal(rows[1].pnl,-400000);
assert.equal(S.mergeImages([{text:'何もない'}]).positions.length,0);
let conflict=S.mergeImages([{text:quantity},{text:quantity.replace('1,000株','1,500株')}]).positions[0];assert.ok(conflict.conflicts.includes('qty'));
console.log('SBI parser: 13 checks passed');
