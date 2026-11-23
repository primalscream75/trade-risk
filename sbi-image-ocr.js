'use strict';
/* On-device ROI OCR for SBI iPhone screenshots. Uses Tesseract loaded by import.js. */
const SbiImageOcr=(()=>{
 async function imageFrom(file){return await new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im);};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('画像を開けません'));};im.src=url;});}
 function crop(im,rect){let w=im.naturalWidth,h=im.naturalHeight;let scale=2;let c=document.createElement('canvas');let cropW=Math.max(1,Math.round(rect.w*w)),cropH=Math.max(1,Math.round(rect.h*h));c.width=cropW*scale;c.height=cropH*scale;let ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.drawImage(im,Math.round(rect.x*w),Math.round(rect.y*h),cropW,cropH,0,0,c.width,c.height);
  // Dark SBI theme: convert colored text (green/white) to black text on white.
  let pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){let r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];let luminosity=Math.max(r,g,b);let v=luminosity>66?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=v;}ctx.putImageData(pixels,0,0);return c;
 }
 async function read(worker,im,rect,numeric=false,mode='6'){
  await worker.setParameters({tessedit_pageseg_mode:mode,tessedit_char_whitelist:numeric?'0123456789,.-()%円株 ':''});
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
    let mid=await readNumericCell(worker,im,SbiRoi.region('middle',idx,type),type==='price'?2:1);
    let right=(idx===0&&type==='quantity'&&right0)?right0:await readNumericCell(worker,im,SbiRoi.region('right',idx,type),1);
    rows.push({left:SbiRoi.cleanCell(left),middle:SbiRoi.cleanCell(mid),right:SbiRoi.cleanCell(right)});
   }
   return {name:file.name,view:type,rows,header:head};
 }
 return {parseFile,crop};
})();if(typeof module!=='undefined')module.exports=SbiImageOcr;
