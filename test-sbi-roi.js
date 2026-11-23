'use strict';const A=require('node:assert/strict'),S=require('./sbi-roi');
A.equal(S.identify('フジクラ\n2603 買建/特定').code,'5803');
A.equal(S.identify('ＧＯ\n706M 買建/特定').code,'581A');
A.equal(S.identify('GO\n581A 買建/特定').code,'581A');
A.equal(S.identify('2,835.5円 2026年'),null);
A.equal(S.detectView('建株数（注文数）評価額前日比',''),'quantity');
A.equal(S.detectView('現在値 平均建単価 評価損益',''),'price');
A.equal(S.region('left',1).y.toFixed(3),'0.370');
A.deepEqual(S.tokens('2,835.5円\n5,621.02円').map(x=>x.value),[2835.5,5621.02]);
let images=[{name:'price',view:'price',rows:[{left:'フジクラ\n5803 買建/特定',middle:'2,835.5円\n5,621.02円',right:'-13,259,413円\n-49.87%'},{left:'GO\n581A 買建/特定',middle:'2,769円\n3,228.42円',right:'-3,602,293円\n-14.78%'}]},{name:'quantity',view:'quantity',rows:[{left:'フジクラ\n5803 買建/特定',middle:'4,700株\n(0)',right:'13,326,850円\n-331,350円(-2.43%)'},{left:'GO\n581A 買建/特定',middle:'7,500株\n(0)',right:'20,767,500円\n-682,500円(-3.18%)'}]}];
let positions=S.mergeStructured(images).positions;
A.equal(positions.length,2);A.equal(positions[0].code,'5803');A.equal(positions[0].qty,4700);A.equal(positions[0].entry,5621.02);A.equal(positions[0].current,2835.5);A.equal(positions[0].marketValue,13326850);A.equal(positions[0].pnl,-13259413);A.deepEqual(positions[0].conflicts,[]);A.equal(positions[1].code,'581A');A.equal(positions[1].qty,7500);A.equal(positions[1].entry,3228.42);A.equal(positions[1].current,2769);A.deepEqual(positions[1].conflicts,[]);
A.equal(S.parseCell('quantity','GO 581A 買建','7,500株 (0)','20,767,500円').qty,7500);
A.equal(S.parseCell('price','2,835.5円','2835.5 5621.02','-13259413'),null);
let bad=S.mergeStructured([{name:'1',view:'quantity',rows:[{left:'フジクラ 5803 買建',middle:'4700株',right:'1,000,000円'}]},{name:'2',view:'price',rows:[{left:'フジクラ 5803 買建',middle:'2835.5円 5621.02円',right:'-13259413円'}]}]);A.ok(bad.positions[0].conflicts.includes('評価額'));
console.log('SBI ROI parsing tests passed');

// Regression: derive display price from quantity and market value, never invent entry price.
{const r=S.mergeStructured([{name:"qty",view:"quantity",rows:[{left:"フジクラ 5803 買建",middle:"4,700株",right:"13,326,850円"}]}]).positions[0]; A.equal(r.current,2835.5);A.equal(r.entry,undefined); A.ok(r.warnings.some(x=>x.includes("評価額÷株数")));}
