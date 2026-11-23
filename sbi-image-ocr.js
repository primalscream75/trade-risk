'use strict';
/* On-device ROI OCR for SBI iPhone screenshots. Uses Tesseract loaded by import.js. */
const SbiImageOcr=(()=>{
 async function imageFrom(file){return await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('画像を開けません'));};im.src=url;});}
 function crop(im,rect){let w=im.naturalWidth,h=im.naturalHeight;let scale=2;let c=document.createElement('canvas');let cropW=Math.max(1,Math.round(rect.w*w)),cropH=Math.max(1,Math.round(rect.h*h));c.width=cropW*scale;c.height=cropH*scale;let ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.drawImage(im,Math.round(rect.x*w),Math.round(rect.y*h),cropW,cropH,0,0,c.width,c.height);
  // Dark SBI theme: convert colored text (green/white) to black text on white.
  let pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){let r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];let luminosity=Math.max(r,g,b);let v=luminosity>66?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}ctx.putImageData(pixels,0,0);return c;
 }
 async function read(worker,im,rect,numeric=false,mode='6'){
  await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:numeric?'0123456789,.-':''});
  let result=await worker.recognize(crop(im,rect));return result.data.text||'';
 }
 // Scan isolated numeric lines instead of assuming two rows are readable in one OCR block.
 // Use a second, larger unbinarized crop if the first attempt has insufficient numeric tokens.
 async function readNumericCell(worker,im,rect,minCount=1){
  const first=await read(worker,im,rect,true,'6');
  if(SbiRoi.tokens(first).length>=minCount)return first;
  const second=await read(worker,im,rect,false,'6');
  if(SbiRoi.tokens(second).length>=minCount)return second;
  const h=rect.h*.53;
  const a=await read(worker,im,{...rect,h},true,'7');
  const b=await read(worker,im,{...rect,y:rect.y+rect.h*.45,h},true,'7');
  const joined=a+'\n'+b;
  const options=[first,second,joined];
  return options.sort((a,b)=>SbiRoi.tokens(b).length-SbiRoi.tokens(a).length)[0];
 }
 // The SBI price column has two lines: current price (top) and average entry (bottom).
 // The rightmost 円 glyph was repeatedly recognized as an extra digit in actual captures.
 // Crop out that glyph and recognize each line individually (PSM 7).
 function fractionalCell(rect, left, top, width, height){
  return {x:rect.x+rect.w*left,y:rect.y+rect.h*top,w:rect.w*width,h:rect.h*height};
 }
 function safePriceText(s){
  // Reject non-numeric artifacts rather than silently changing a trading price.
  const t=String(s||'').trim().replace(/[，]/g,',').replace(/[．]/g,'.').replace(/\s/g,'');
  return /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,4})?$/.test(t)?t:'';
 }
 // Retry only unreadable cells with slightly different crop geometry and segmentation.
 // This handles dropped decimal points, the currency glyph and green negative P&L text.
 // Do not derive an entry price from P&L or carry a value across unrelated screenshots.
 function numericPriceCandidate(text){
  const normalized=String(text||'').replace(/[，]/g,',').replace(/[．]/g,'.').replace(/\s/g,'').replace(/[円¥]/g,'');
  return safePriceText(normalized);
 }
 function numericPnlCandidate(text){
  const normalized=String(text||'').replace(/[，]/g,',').replace(/[－−―]/g,'-').replace(/[円¥\s]/g,'');
  return /^-?(?:\d{1,3}(?:,\d{3})+|\d+)$/.test(normalized)&&Number.isSafeInteger(Number(normalized.replace(/,/g,'')))?normalized:'';
 }
 async function retryCell(worker,im,base,kind){
  const isPnl=kind==='pnl';
  // The first crop is compatible with 0.9.4. Alternate crops widen/shift the
  // numeric area but still exclude the border and as much of 円 as possible.
  const variants=isPnl?[
   [.02,.05,.89,.49,'7'],[.005,.02,.94,.52,'7'],[.02,.08,.87,.40,'6'],[.04,.03,.88,.50,'13'],[.005,.04,.98,.49,'7'],[.0,.0,1,.53,'6']
  ]:kind==='entry'?[
   [.12,.50,.75,.47,'7'],[.05,.48,.81,.50,'7'],[.14,.54,.70,.39,'13'],[.02,.48,.82,.50,'6'],[.07,.53,.74,.40,'7'],[.17,.49,.66,.49,'7']
  ]:[
   [.12,.06,.75,.44,'7'],[.05,.04,.81,.45,'7'],[.14,.08,.70,.40,'13'],[.02,.03,.82,.47,'6']
  ];
  const normalize=isPnl?numericPnlCandidate:numericPriceCandidate;
  for(const [x,y,w,h,mode] of variants){
   const result=normalize(await read(worker,im,fractionalCell(base,x,y,w,h),true,mode));
   if(!result)continue;
   const n=Number(result.replace(/,/g,''));
   if(isPnl ? (n<0&&Math.abs(n)>=1000) : (n>0&&n<1000000))return result;
  }
  return '';
 }
 async function readPriceLines(worker,im,rect){
  const one=await retryCell(worker,im,rect,'current');
  const two=await retryCell(worker,im,rect,'entry');
  return [one,two].join('\n');
 }
 async function readPnlLine(worker,im,rect){return retryCell(worker,im,rect,'pnl');}
 async function parseFile(file,worker,progress){let im=await imageFrom(file);if(im.naturalWidth>=im.naturalHeight)throw Error('SBIの縦長スクリーンショットを選んでください');
   // First identify table type by header. If OCR misses header, inspect first numeric right cell.
   let head=await read(worker,im,SbiRoi.region('header'));
   let type=SbiRoi.detectView(head,'');let right0='';if(!type){right0=await read(worker,im,SbiRoi.region('right',0,'quantity'),true);type=SbiRoi.detectView('',right0);}
   if(!type){
    await worker.setParameters({tessedit_pageseg_mode:'3',tessedit_char_whitelist:''});
    const full=await worker.recognize(im);const text=full.data.text||'';
    if(/委託保証金|建代金合計|信用建余力/.test(text))return {name:file.name,view:'margin',text,rows:[],header:head};
    throw Error('信用建玉・保証金画面を判別できません（対象画像は候補にしません）');
   }
   let rows=[];for(let idx=0;idx<8;idx++){
    let left=await read(worker,im,SbiRoi.region('left',idx,type));
    if(idx>0&&!left.trim())break;
    if(!left.trim()){if(idx===0)continue;break;}
    if(progress)progress(`${file.name}: ${idx+1}行目を確認中`);
    let mid=type==='price'?await readPriceLines(worker,im,SbiRoi.region('middle',idx,type)):await readNumericCell(worker,im,SbiRoi.region('middle',idx,type),1);
    let right=type==='price'?await readPnlLine(worker,im,SbiRoi.region('right',idx,type)):(idx===0&&type==='quantity'&&right0)?right0:await readNumericCell(worker,im,SbiRoi.region('right',idx,type),1);
    rows.push({left:SbiRoi.cleanCell(left),middle:SbiRoi.cleanCell(mid),right:SbiRoi.cleanCell(right)});
   }
   return {name:file.name,view:type,rows,header:head};
 }
 return {parseFile,crop,fractionalCell,safePriceText,numericPriceCandidate,numericPnlCandidate,retryCell};
})();if(typeof module!=='undefined')module.exports=SbiImageOcr;
