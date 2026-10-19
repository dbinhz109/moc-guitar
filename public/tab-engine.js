(function(root){
'use strict';
function staffBands(image){
 const {width:w,height:h,data}=image,rows=[];
 for(let y=0;y<h;y++){let dark=0;for(let x=Math.floor(w*.06);x<w*.94;x++){const i=(y*w+x)*4;if(data[i]+data[i+1]+data[i+2]<675)dark++;}if(dark>w*.61)rows.push(y);}
 const strokes=[];for(const y of rows){if(strokes.length&&y-strokes.at(-1).at(-1)===1)strokes.at(-1).push(y);else strokes.push([y]);}
 const center=s=>s.reduce((a,b)=>a+b,0)/s.length,bands=[];
 for(let i=0;i<strokes.length;){let found=false;
  for(const size of [6,5]){
   if(i+size>strokes.length)continue;
   const selected=strokes.slice(i,i+size),lines=selected.map(center),spacing=(lines.at(-1)-lines[0])/(size-1);
   if(spacing<2||spacing>w*.04||!lines.every((y,j)=>!j||Math.abs(y-lines[j-1]-spacing)<=Math.max(1,spacing*.2)))continue;
   const g=selected.flat();bands.push({top:Math.max(0,g[0]-Math.max(13,(g.at(-1)-g[0])*1.3)),bottom:g[0]-1,staffTop:g[0],staffBottom:g.at(-1),lines,lineRows:g,lineCount:size,spacing,regular:true});
   i+=size;found=true;break;
  }
  if(!found)i++;
 }
 // Keep the earlier five-line label reader usable when one faint ruling is missing.
 // Regular six-line TAB was already claimed above, so it cannot enter this fallback.
 const legacy=[];for(const y of rows){const last=legacy.at(-1);if(last&&y-last.at(-1)<=Math.max(5,h*.015))last.push(y);else legacy.push([y]);}
 for(const g of legacy){
  if(g.length<4||g.at(-1)-g[0]<=h*.01||g.at(-1)-g[0]>=h*.065||bands.some(b=>g[0]<=b.staffBottom&&g.at(-1)>=b.staffTop))continue;
  const lines=strokes.filter(s=>s[0]>=g[0]&&s.at(-1)<=g.at(-1)).map(center);
  if(lines.length<4)continue;
  bands.push({top:Math.max(0,g[0]-Math.max(13,(g.at(-1)-g[0])*1.3)),bottom:g[0]-1,staffTop:g[0],staffBottom:g.at(-1),lines,lineRows:g,lineCount:lines.length,spacing:(lines.at(-1)-lines[0])/(lines.length-1),regular:false});
 }
 return bands.sort((a,b)=>a.staffTop-b.staffTop);
}
function regions(image,band){
 const {width:w,height:h,data}=image,d=band.spacing,dark=(x,y)=>{const i=(y*w+x)*4;return data[i]+data[i+1]+data[i+2]<600};
 const vertical=new Set();for(let x=0;x<w;x++){let count=0;for(let y=Math.ceil(band.lines[0]);y<=band.lines.at(-1);y++)if(dark(x,y))count++;if(count>(band.lines.at(-1)-band.lines[0])*.85)vertical.add(x);}
 let left=w,right=0;for(let x=0;x<w;x++){if(band.lines.filter(y=>dark(x,Math.round(y))).length>=4){left=Math.min(left,x);right=Math.max(right,x);}}
 const result=[];
 for(const [lane,cy] of band.lines.entries()){
  const top=Math.max(0,Math.round(cy-d*.5)),bottom=Math.min(h,Math.round(cy+d*.5)),columns=[];
  for(let x=Math.ceil(left+d*1.5);x<right-1;x++){
   if(vertical.has(x))continue;
   for(let y=top;y<bottom;y++)if(!band.lineRows.includes(y)&&dark(x,y)){columns.push(x);break;}
  }
  const runs=[];for(const x of columns){if(runs.length&&x-runs.at(-1).at(-1)<=Math.max(1,Math.round(d*.25)))runs.at(-1).push(x);else runs.push([x]);}
  for(const run of runs){const width=run.at(-1)-run[0]+1;if(width>d*2.4)continue;let area=0;for(const x of run)for(let y=top;y<bottom;y++)if(!band.lineRows.includes(y)&&dark(x,y))area++;
   if(area<Math.max(2,d*.3))continue;
   result.push({string:lane+1,x:Math.max(0,run[0]-1),y:top,width:width+2,height:bottom-top,center:(run[0]+run.at(-1))/2});
  }
 }
 return result.sort((a,b)=>a.center-b.center||a.string-b.string);
}
function columns(points,tolerance){
 const result=[];for(const point of [...points].sort((a,b)=>a.center-b.center||a.string-b.string)){
  const last=result.at(-1);
  if(last&&Math.abs(point.center-last.x)<=tolerance&&!last.positions.some(p=>p.string===point.string))last.positions.push(point);
  else result.push({x:point.center,beats:null,positions:[point]});
 }for(const c of result)c.positions.sort((a,b)=>a.string-b.string);return result;
}
function sections(draft){
 if(unresolved(draft))return [];
 return draft.map((line,i)=>{const bars=[];let previous;
  for(const c of line.columns){
   const source=root.MocNotes.parseTabToken('@'+c.positions.map(p=>p.string+'/'+p.fret).join('+'));if(!source)continue;
   const key=c.bar??0;
   if(!bars.length||key!==previous)bars.push({explicit:key>0,events:[]});
   bars.at(-1).events.push({chord:'-',...source,beats:c.beats??null});previous=key;
  }
  return {name:line.name||'Section '+(i+1),repeat:line.repeat||1,bars};
 }).filter(s=>s.bars.length);
}
function fromSections(sections){return sections.map(s=>({name:s.name,repeat:s.repeat,columns:s.bars.flatMap((b,bi)=>b.events.map(e=>({bar:b.explicit===false?null:bi+1,beats:e.beats,positions:(e.tab||[]).map(p=>({...p}))})))}));}
function unresolved(draft){return draft.reduce((n,line)=>n+line.columns.reduce((m,c)=>m+c.positions.filter(p=>!Number.isInteger(p.fret)||p.fret<0||p.fret>24).length,0),0);}
function validBars(draft){return draft.every(line=>{
 const assigned=line.columns.filter(c=>c.bar!==null&&c.bar!==undefined);if(!assigned.length)return true;
 if(assigned.length!==line.columns.length||assigned[0].bar!==1)return false;
 return assigned.every((c,i)=>Number.isInteger(c.bar)&&c.bar>=1&&c.bar<=256&&(!i||c.bar===assigned[i-1].bar||c.bar===assigned[i-1].bar+1));
});}
function textTab(text){
 const lines=String(text).slice(0,100000).split(/\r?\n/),draft=[],warnings=[];let count=0;
 for(let i=0;i<=lines.length-6;i++){
  const six=lines.slice(i,i+6).map(l=>l.match(/^\s*([eBGDAE])\s*\|([^\r\n]*)$/));
  if(!six.every(Boolean)||six.map(m=>m[1]).join('')!=='eBGDAE')continue;
  const points=[];six.forEach((m,lane)=>{if(/[^\d\s|\-]/.test(m[2]))warnings.push('techniques');for(const token of m[2].matchAll(/\d+/g)){count++;const fret=Number(token[0]);points.push({string:lane+1,fret:fret<=24?fret:null,center:token.index,confidence:100});}});
  if(count>512||draft.length>=100)return {draft:[],warnings:['size'],blocked:true};
  draft.push({columns:columns(points,0)});i+=5;
 }
 return {draft,warnings:[...new Set(warnings)]};
}
root.MocTab={staffBands,regions,columns,sections,fromSections,unresolved,validBars,textTab};
})(globalThis);
