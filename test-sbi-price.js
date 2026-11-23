const assert=require('node:assert/strict');
const P=require('./sbi-image-ocr.js'),S=require('./sbi-roi.js');
assert.equal(P.safePriceText('5,621.02'),'5,621.02');
assert.equal(P.safePriceText('3,228.42'),'3,228.42');
assert.equal(P.safePriceText('2,835.5円'),'');
assert.equal(P.safePriceText('5,621.0249'),'5,621.0249'); // market-value reconciliation guards mistakes; OCR confidence remains advisory
assert.equal(P.safePriceText(''), '');
const base=S.region('middle',0,'price');
const u=P.fractionalCell(base,.12,.06,.75,.44);
const l=P.fractionalCell(base,.12,.50,.75,.47);
assert.ok(u.x>base.x&&u.x+u.w<base.x+base.w);
assert.ok(u.y+u.h<=l.y+1e-10);
assert.ok(l.y+l.h<=base.y+base.h+1e-10);
const right=P.fractionalCell(S.region('right',0,'price'),.02,.05,.89,.49);
assert.ok(right.w>0&&right.h>0);
for (const [left,mid,rightText,entry,current,pnl] of [
 ['フジクラ 5803 買建','2,835.5\n5,621.02','-13,259,413',5621.02,2835.5,-13259413],
 ['GO 581A 買建','2,769\n3,228.42','-3,602,293',3228.42,2769,-3602293]]) {
 let r=S.parseCell('price',left,mid,rightText);
 assert.equal(r.entry,entry);assert.equal(r.current,current);assert.equal(r.pnl,pnl);
}
console.log('SBI cropped price parsing tests passed');
