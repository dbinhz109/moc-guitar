(function(root){
'use strict';
// Locate text-sized connected ink components above a staff, independently of OCR.
// Input is an above-staff crop; the full page's left margin must not be discarded.
function textRegions(image,staffHeight){
 const {width,height,data}=image,ink=new Uint8Array(width*height),stack=new Int32Array(width*height),components=[];
 for(let i=0;i<ink.length;i++)ink[i]=(data[i*4]+data[i*4+1]+data[i*4+2])<480?1:0;
 for(let index=0;index<ink.length;index++){
  if(!ink[index])continue;
  let count=0,head=0,area=0,x0=width,x1=0,y0=height,y1=0;stack[count++]=index;ink[index]=0;
  while(head<count){const point=stack[head++],x=point%width,y=Math.floor(point/width);area++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=width||ny<0||ny>=height)continue;const next=ny*width+nx;if(ink[next]){ink[next]=0;stack[count++]=next;}}
  }
  const h=y1-y0+1,w=x1-x0+1;
  if(h>=Math.max(2,staffHeight*.14)&&h<=staffHeight*.8&&y1<height-staffHeight*.17&&w>=2&&area>=Math.max(2,staffHeight*.04))components.push({x:x0,y:y0,width:w,height:h});
 }
 const groups=[];
 for(const box of components.sort((a,b)=>a.x-b.x)){
  const previous=groups.at(-1),overlap=previous?Math.min(box.y+box.height,previous.y+previous.height)-Math.max(box.y,previous.y):0;
  if(previous&&box.x-previous.x-previous.width<Math.max(box.height,previous.height)*.6&&overlap>Math.min(box.height,previous.height)*.3){
   const right=Math.max(previous.x+previous.width,box.x+box.width),bottom=Math.max(previous.y+previous.height,box.y+box.height);previous.y=Math.min(previous.y,box.y);previous.width=right-previous.x;previous.height=bottom-previous.y;
  }else groups.push({...box});
 }
 return groups.filter(b=>b.height>=Math.max(3,staffHeight*.23)&&b.width<=staffHeight*5);
}
function chordToken(text){
 const token=String(text).replace(/♯/g,'#').replace(/♭/g,'b').replace(/\s+/g,'').replace(/^[\[\]().,:;_]+|[\[\]().,:;_]+$/g,'');
 return /^[A-G](?:#|b)?(?:maj7|maj9|m7|m9|m6|m|7|9|6|sus2|sus4|sus|add9|dim7|dim|aug)?(?:\/[A-G](?:#|b)?)?$/.test(token)?token:null;
}
function chooseReading(readings){return readings.map(r=>({...r,chord:chordToken(r.text)})).filter(r=>r.chord).sort((a,b)=>b.confidence-a.confidence)[0]||null}
root.MocScoreGlyphs={textRegions,chordToken,chooseReading};
})(globalThis);
