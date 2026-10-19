(function(root){
function rewrite(chart,annotations,action){
 const pg=root.MocPractice,parsed=pg.parseChart(chart,{strict:true,allowSingle:true});
 if(parsed.invalid.length)throw Error('chart');
 const sections=parsed.sections;const slots=[];
 sections.forEach((s,si)=>s.bars.forEach((b,bi)=>b.events.forEach((e,ei)=>slots.push({si,bi,ei,e}))));
 let index=action.index;
 const anchors=annotations.map(a=>({...a}));
 if(action.type==='add'){
  index=Math.max(0,Math.min(slots.length,Number.isInteger(index)?index:slots.length));
  const event={chord:action.chord,beats:action.beats};
  if(index<slots.length){const slot=slots[index];sections[slot.si].bars[slot.bi].events.splice(slot.ei,0,event)}
  else if(sections.length)sections.at(-1).bars.push({events:[event],explicit:false});
  else sections.push({name:'Section 1',repeat:1,bars:[{events:[event],explicit:false}]});
  for(const a of anchors)if(a.index>=index)a.index++;
  anchors.push({...action.anchor,index,chord:action.chord});
 }else{
  const slot=slots[index];if(!slot)throw Error('anchor');
  if(action.type==='delete'){
   sections[slot.si].bars[slot.bi].events.splice(slot.ei,1);
   for(let i=anchors.length-1;i>=0;i--){if(anchors[i].index===index)anchors.splice(i,1);else if(anchors[i].index>index)anchors[i].index--;}
  }else{
   slot.e.chord=action.chord;slot.e.beats=action.beats;delete slot.e.notes;
   for(const a of anchors)if(a.index===index)a.chord=action.chord;
  }
 }
 const clean=sections.map(s=>({...s,bars:s.bars.filter(b=>b.events.length)})).filter(s=>s.bars.length);
 return {chart:pg.chartText(clean),anchors};
}
root.MocReview={rewrite};
})(globalThis);
