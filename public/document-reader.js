(function(root){
let pdfPromise,ocrScript;
async function pdfLibrary(){pdfPromise=pdfPromise||import('/vendor/pdfjs/pdf.mjs');const pdf=await pdfPromise;pdf.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';return pdf}
function staffBands(canvas){const context=canvas.getContext('2d',{willReadFrequently:true}),{width:w,height:h}=canvas,data=context.getImageData(0,0,w,h).data;const rows=[];for(let y=0;y<h;y++){let dark=0;for(let x=Math.floor(w*.06);x<w*.94;x++){const i=(y*w+x)*4;if((data[i]+data[i+1]+data[i+2])/3<225)dark++}if(dark>w*.61)rows.push(y)}const groups=[];for(const y of rows){const last=groups.at(-1);if(last&&y-last.at(-1)<=Math.max(5,h*.015))last.push(y);else groups.push([y])}return groups.filter(group=>group.length>=4&&group.at(-1)-group[0]>h*.01&&group.at(-1)-group[0]<h*.065).map(group=>({top:Math.max(0,group[0]-Math.max(13,(group.at(-1)-group[0])*1.3)),bottom:group[0]-1,staffTop:group[0],staffBottom:group.at(-1)}))}
async function imageCanvas(blob){const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');const scale=Math.min(1,2200/bitmap.width,3500/bitmap.height);canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas}
function upscaleStrip(canvas,band){const crop=document.createElement('canvas');const scale=Math.min(5,2200/canvas.width);const x=Math.round(canvas.width*.105),width=Math.round(canvas.width*.84),height=Math.max(8,band.bottom-band.top);crop.width=Math.round(width*scale);crop.height=Math.round(height*scale);const ctx=crop.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,crop.width,crop.height);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,x,band.top,width,height,0,0,crop.width,crop.height);crop.sourceRect={x,y:band.top,width,height};return crop}
async function ocrCanvas(canvas,options){if(!ocrScript)ocrScript=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/vendor/ocr/tesseract.min.js';script.onload=resolve;script.onerror=()=>{ocrScript=null;reject(Error('ocr-load'))};document.head.append(script)});await ocrScript;if(!options.isCurrent())throw Error('cancelled');const worker=await Tesseract.createWorker('eng',1,{workerPath:'/vendor/ocr/worker.min.js',corePath:'/vendor/ocr/core',workerBlobURL:false,logger:m=>{if(options.isCurrent()&&m.status==='recognizing text')options.onStatus?.({stage:'ocr',progress:m.progress})}});if(!options.isCurrent()){await worker.terminate();throw Error('cancelled')}options.onCancel(()=>worker.terminate());try{
 const bands=staffBands(canvas);if(options.kind!=='text'&&bands.length>=2){const lines=[],raw=[],anchors=[];for(let i=0;i<bands.length;i++){if(!options.isCurrent())throw Error('cancelled');options.onStatus?.({stage:'staff',line:i+1,total:bands.length});const result=await staffLabels(worker,canvas,bands[i],options);raw.push(result.raw);const candidates=result.labels;for(const candidate of candidates)anchors.push({...candidate,id:crypto.randomUUID(),index:anchors.length,region:i});lines.push(`Section ${i+1}\n`+candidates.map(c=>'['+c.chord+']').join(' '));}return {text:lines.join('\n\n'),raw:raw.join('\n'),mode:'staff-ocr',kind:'score',anchors,missingStaffs:lines.flatMap((line,i)=>line.split('\n')[1]?.trim()?[]:[i+1]),staffCount:bands.length,regions:bands.filter((b,i)=>lines[i].split('\n')[1]?.trim()).map(b=>({top:b.top/canvas.height,height:(b.staffBottom-b.top+20)/canvas.height})),lowResolution:canvas.width<700};}
 await worker.setParameters({tessedit_pageseg_mode:'11',preserve_interword_spaces:'1'});const result=await worker.recognize(canvas);return {text:result.data.text,mode:'ocr',kind:options.kind==='auto'?'chords':options.kind,lowResolution:canvas.width<700};
 }finally{await worker.terminate().catch(()=>{})}}

async function staffLabels(worker,canvas,band,options){
 const staffHeight=band.staffBottom-band.staffTop;
 if(staffHeight<24){await worker.setParameters({tessedit_pageseg_mode:'7',preserve_interword_spaces:'1',tessedit_char_whitelist:''});const strip=upscaleStrip(canvas,band),result=await worker.recognize(strip,{}, {text:true,blocks:true});return {labels:ocrLabels(result.data,strip,canvas),raw:result.data.text.trim()};}
 const top=Math.max(0,Math.floor(band.staffTop-staffHeight*1.8)),height=band.staffTop-top;
 const image=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,top,canvas.width,height);
 const boxes=MocScoreGlyphs.textRegions(image,staffHeight),labels=[],raw=[];
 await worker.setParameters({tessedit_pageseg_mode:'7',preserve_interword_spaces:'1',tessedit_char_whitelist:'ABCDEFGb#msuajdign0123456789/'});
 for(const box of boxes){
  if(!options.isCurrent())throw Error('cancelled');
  const readings=[];
  for(const [target,binary] of [[64,true],[32,false],[48,true]]){
   const crop=document.createElement('canvas'),scale=target/box.height,padding=12;
   crop.width=Math.round(box.width*scale)+padding*2;crop.height=target+padding*2;
   const context=crop.getContext('2d',{willReadFrequently:true});context.fillStyle='white';context.fillRect(0,0,crop.width,crop.height);
   context.drawImage(canvas,box.x,top+box.y,box.width,box.height,padding,padding,box.width*scale,target);
   if(binary){const pixels=context.getImageData(0,0,crop.width,crop.height);for(let i=0;i<pixels.data.length;i+=4){const value=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])<510?0:255;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}context.putImageData(pixels,0,0);}
   const data=(await worker.recognize(crop)).data;readings.push({text:data.text.trim(),confidence:Number(data.confidence)||0});
   const best=MocScoreGlyphs.chooseReading(readings);
   if(best&&best.confidence>=75||/^\d+$/.test(data.text.trim())&&data.confidence>=65)break;
  }
  const best=MocScoreGlyphs.chooseReading(readings);raw.push(readings.map(r=>r.text||'∅').join(' / '));
  if(best)labels.push({chord:best.chord,confidence:best.confidence,x:box.x/canvas.width,y:(top+box.y)/canvas.height,width:box.width/canvas.width,height:box.height/canvas.height});
 }
 return {labels,raw:raw.join(' · ')};
}
function ocrLabels(data,strip,canvas){
 const pattern=/(?<![a-zA-Z])[A-G](?:#|b)?(?:maj7|m7|m|7|sus2|sus4|add9)?(?:\/[A-G](?:#|b)?)?(?![a-zA-Z])/g;
 const words=[];function walk(node){if(!node)return;if(Array.isArray(node)){node.forEach(walk);return}if(node.words){words.push(...node.words);return}for(const key of ['blocks','paragraphs','lines'])if(node[key])walk(node[key]);}walk(data);
 const labels=[],rect=strip.sourceRect;for(const word of words.sort((a,b)=>a.bbox.x0-b.bbox.x0)){for(const match of word.text.replace(/♯/g,'#').matchAll(pattern)){const box=word.bbox;labels.push({chord:match[0],confidence:Number(word.confidence)||0,x:(rect.x+box.x0/strip.width*rect.width)/canvas.width,y:(rect.y+box.y0/strip.height*rect.height)/canvas.height,width:(box.x1-box.x0)/strip.width*rect.width/canvas.width,height:(box.y1-box.y0)/strip.height*rect.height/canvas.height});}}
 // A missing word-box result must not suppress recognition; these labels remain editable in the plan.
 return labels.length?labels:(data.text.replace(/♯/g,'#').match(pattern)||[]).map(chord=>({chord,confidence:0}));
}
async function musicXML(file,options={}){
 const xmlModule=await import('/musicxml.mjs');const blob=await ensureBlob(file);let xml;
 if(file.ext==='mxl'){const {unzipSync}=await import('/vendor/musicxml/fflate.mjs');xml=xmlModule.unpackMusicXML(new Uint8Array(await blob.arrayBuffer()),unzipSync)}else xml=new TextDecoder('utf-8',{fatal:true}).decode(await blob.arrayBuffer());
 const result=xmlModule.readMusicXML(xml,{part:options.part,mode:options.musicMode,voice:options.voice});
 return {xml:result,text:MocPractice.chartText(result.sections),mode:'musicxml',kind:'musicxml',pages:1};
}

async function read(file,options){const blob=await ensureBlob(file);if(['xml','musicxml','mxl'].includes(file.ext))return musicXML({...file,blob},options);if(['txt','md'].includes(file.ext))return {text:(await blob.text()).slice(0,100000),mode:'text',kind:'chords',pages:1};if(file.ext!=='pdf')return ocrCanvas(await imageCanvas(blob),options);
 const pdf=await pdfLibrary();const task=pdf.getDocument({data:new Uint8Array(await blob.arrayBuffer()),wasmUrl:'/vendor/pdfjs/wasm/',standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,isEvalSupported:false});options.onCancel(()=>task.destroy());try{const doc=await task.promise;if(options.page<1||options.page>doc.numPages)throw Error('page');const page=await doc.getPage(options.page);const content=await page.getTextContent();let text='',lastY=null;for(const item of content.items){if(!('str'in item))continue;const y=Math.round(item.transform[5]);if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=item.hasEOL?null:y}
 if(text.trim().length>=8&&options.kind!=='score')return {text,mode:'text',kind:'chords',pages:doc.numPages};const viewport=page.getViewport({scale:1.7});const scale=Math.min(1,2200/viewport.width,3500/viewport.height);const actual=page.getViewport({scale:1.7*scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(actual.width);canvas.height=Math.ceil(actual.height);await page.render({canvas,canvasContext:canvas.getContext('2d'),viewport:actual}).promise;return {...await ocrCanvas(canvas,options),pages:doc.numPages};}finally{await task.destroy()}}
root.MocDocuments={read,staffBands,musicXML};
})(globalThis);
