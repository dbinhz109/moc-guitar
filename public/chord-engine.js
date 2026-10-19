(function(root){
'use strict';
const shapes={
 C:[-1,3,2,0,1,0],Cm:[-1,3,5,5,4,3],C7:[-1,3,2,3,1,0],Cmaj7:[-1,3,2,0,0,0],
 D:[-1,-1,0,2,3,2],Dm:[-1,-1,0,2,3,1],D7:[-1,-1,0,2,1,2],Dm7:[-1,-1,0,2,1,1],Dsus2:[-1,-1,0,2,3,0],Dsus4:[-1,-1,0,2,3,3],
 E:[0,2,2,1,0,0],Em:[0,2,2,0,0,0],E7:[0,2,0,1,0,0],Em7:[0,2,2,0,3,0],
 F:[1,3,3,2,1,1],Fm:[1,3,3,1,1,1],Fmaj7:[-1,-1,3,2,1,0],
 G:[3,2,0,0,0,3],Gm:[3,5,5,3,3,3],G7:[3,2,0,0,0,1],Gmaj7:[3,2,0,0,0,2],
 A:[-1,0,2,2,2,0],Am:[-1,0,2,2,1,0],A7:[-1,0,2,0,2,0],Am7:[-1,0,2,0,1,0],Asus2:[-1,0,2,2,0,0],Asus4:[-1,0,2,2,3,0],
 B:[-1,2,4,4,4,2],Bm:[-1,2,4,4,3,2],B7:[-1,2,1,2,0,2],Bm7:[-1,2,4,2,3,2],
 Bb:[-1,1,3,3,3,1],'F#':[2,4,4,3,2,2],'F#m':[2,4,4,2,2,2],'C/G':[3,3,2,0,1,0],'D/F#':[2,-1,0,2,3,2],'G/B':[-1,2,0,0,0,3]
};
const chordSource='[A-G](?:#|b)?(?:maj7|maj9|m7|m9|m6|m|7|9|6|sus2|sus4|sus|add9|dim7|dim|aug)?(?:/[A-G](?:#|b)?)?';
const exact=new RegExp('^'+chordSource+'$');
const aliases={'C♯':'C#','D♭':'Db','E♭':'Eb','F♯':'F#','G♭':'Gb','A♭':'Ab','B♭':'Bb',Gb:'F#',Gbm:'F#m','Csus':'Csus4','Dsus':'Dsus4','Asus':'Asus4'};
function normalize(value){const x=value.replace(/♯/g,'#').replace(/♭/g,'b').trim();return aliases[x]||x}
function parseSequence(value){
 const tokens=value.replace(/[\[\]()|,;·→–—]/g,' ').split(/\s+/).filter(Boolean);
 const sequence=[],invalid=[];
 for(const token of tokens){const chord=normalize(token);if(exact.test(chord))sequence.push(chord);else invalid.push(token)}
 return {sequence,invalid,unsupported:[...new Set(sequence.filter(c=>!shapes[c]))]};
}
function parseChart(text,options={}){
 const sections=[];let section={name:'',repeat:1,bars:[]};let invalid=[];let explicit=false;
 const lines=String(text).slice(0,100000).split(/\r?\n/);
 const candidateLines=lines.filter(line=>{const x=line.trim();return exact.test(normalize(x))}).length;
 function flush(){if(section.bars.length)sections.push(section);section={name:'',repeat:1,bars:[]}}
 function eventsFor(value){
  const events=[];for(const raw of value.trim().split(/\s+/).filter(Boolean)){
   const token=raw.replace(/^[\[\](]+|[\])]+$/g,'');
   const match=token.match(/^(.+?)(?::(\?|\d+(?:\.\d+)?))?$/);if(!match)continue;
   const chord=normalize(match[1]);const beats=match[2]&&match[2]!=='?'?Number(match[2]):null;
   const tab=root.MocNotes?.parseTabToken(chord);const notes=tab?.notes||root.MocNotes?.parseNoteToken(chord);
   if(!exact.test(chord)&&chord!=='-'&&!notes){invalid.push(raw);continue}
   if(beats!==null&&(!Number.isFinite(beats)||beats<=0||beats>32)){invalid.push(raw);continue}
   events.push({chord:notes?'-':chord,...(notes?{notes}:{}),...(tab?{tab:tab.tab}:{}),beats});
  }return events;
 }
 for(let line of lines){line=line.trim();if(!line)continue;
  const heading=line.match(/^(?:\[)?(Intro|Verse|Chorus|Bridge|Outro|Section|Đoạn|Điệp khúc)(?:\s+(\d+))?(?:\])?\s*(?:[x×]\s*(\d+))?\s*:?\s*(.*)$/i);
  if(heading){flush();section.name=heading[1]+(heading[2]?' '+heading[2]:'');section.repeat=Math.min(8,Number(heading[3])||1);line=heading[4].trim();if(!line)continue;}
  const repeat=line.match(/\s+[x×]\s*(\d+)\s*$/i);if(repeat){section.repeat=Math.min(8,Number(repeat[1])||1);line=line.slice(0,repeat.index).trim();}
  const bracketed=[...line.matchAll(new RegExp('\\[('+chordSource+')\\]','g'))].map(m=>({chord:normalize(m[1]),beats:null}));
  if(bracketed.length){section.bars.push({events:bracketed,explicit:false});continue}
  const tokenText=line.replace(/[|,;·→–—]/g,' ').trim();
  const raw=tokenText.split(/\s+/).filter(Boolean);
  const joined=raw.flatMap(token=>exact.test(normalize(token))?[token]:(raw.length>1&&new RegExp('^(?:'+chordSource+')+$').test(normalize(token))?normalize(token).match(new RegExp(chordSource,'g')):[token]));
  const all=joined.every(token=>token==='-'||root.MocNotes?.parseNoteToken(token.split(':')[0])||root.MocNotes?.parseTabToken(token.split(':')[0])||new RegExp('^(?:'+chordSource+'|\\-)(?::(?:\\?|[0-9]+(?:\\.[0-9]+)?))?$').test(normalize(token)));
  if(!all||!joined.length){if(options.strict)invalid.push(line);continue;}
  if(joined.length===1&&joined[0].length===1&&!options.allowSingle&&candidateLines<2)continue;
  // A timed line without separators is one bar, including a saved single-bar section.
  // Untimed labels stay in an unmeasured group until bar boundaries are reviewed.
  if(line.includes('|')||joined.some(token=>/:\d/.test(token))){explicit=true;for(const barText of line.split('|').filter(x=>x.trim())){const events=eventsFor(barText);if(events.length)section.bars.push({events,explicit:true})}}
  else{const events=joined.flatMap(token=>eventsFor(token));if(events.length)section.bars.push({events,explicit:false})}
 }
 flush();return {sections,invalid,explicit};
}
function detect(text,options={}){
 const parsed=parseChart(text,options);const sequence=parsed.sections.flatMap(s=>s.bars.flatMap(b=>b.events.filter(e=>e.chord!=='-').map(e=>e.chord))).slice(0,256);
 const time=text.match(/\b(2\/4|3\/4|4\/4|6\/8)\b/);const tempo=text.match(/\b(\d{2,3})\s*BPM\b/i);
 return {...parsed,sequence,confidence:sequence.length?'review':'none',unsupported:[...new Set(sequence.filter(c=>!shapes[c]))],meter:time?time[1]:null,bpm:tempo&&+tempo[1]>=40&&+tempo[1]<=180?+tempo[1]:null,hasTab:/^[eBGDAE]\s*\|[-\d|hpbr~\/\\]+/m.test(text)};
}
function chartText(sections){return sections.map(s=>{const unmeasured=s.bars.every(b=>b.explicit===false&&b.events.every(e=>e.beats===null));return (s.name||'Section')+(s.repeat>1?' x'+s.repeat:'')+'\n'+s.bars.map(b=>b.events.map(e=>(root.MocNotes?.eventToken(e)||e.chord)+':'+(e.beats??'?')).join(' ')).join(unmeasured?' ':' | ')}).join('\n\n')}
function fillTiming(sections,meter){const count=Number(meter.split('/')[0]);return sections.map(s=>({...s,bars:s.bars.flatMap(b=>b.events.map(e=>({events:[{...e,beats:count}],explicit:true})))}))}
function makeTimeline(sections,meter){if(!['2/4','3/4','4/4','6/8'].includes(meter))throw Error('meter');const count=Number(meter.split('/')[0]);let cursor=0;const events=[];
 for(let si=0;si<sections.length;si++){const section=sections[si];if(!Number.isInteger(section.repeat)||section.repeat<1||section.repeat>8)throw Error('repeat');
  for(let repeat=0;repeat<section.repeat;repeat++)for(let bi=0;bi<section.bars.length;bi++){const bar=section.bars[bi];const sum=bar.events.reduce((sum,e)=>sum+(e.beats||0),0);if(!bar.events.length||bar.events.some(e=>!Number.isFinite(e.beats)||e.beats<=0)||Math.abs(sum-count)>.001)throw Error('duration');
   for(const [eventIndex,event] of bar.events.entries()){if(event.tab){const source=root.MocNotes.parseTabToken(root.MocNotes.tabToken(event.tab));if(!source||JSON.stringify(source.notes)!==JSON.stringify(event.notes))throw Error('tab')}if(event.notes?.length){if(event.chord!=='-'||event.notes.length>6||event.notes.some(n=>!Number.isInteger(n)||n<40||n>88))throw Error('chord')}else if(event.chord!=='-'&&!shapes[event.chord])throw Error('chord');events.push({...event,eventIndex,start:cursor,section:si,bar:bi,repeat});cursor+=event.beats;}
  }
 }if(!events.length||events.length>2048)throw Error('empty');return {events,total:cursor};
}
function segments(sequence,size=4){const result=[];for(let i=0;i<sequence.length;i+=size)result.push(sequence.slice(i,i+size));return result}
function fingering(chord,language){const shape=shapes[chord];if(!shape)return '';
 const vi=language==='vi';const fretted=shape.map((f,i)=>f>0?(vi?`dây ${6-i}, ngăn ${f}`:`string ${6-i}, fret ${f}`):null).filter(Boolean);
 const skip=shape.map((f,i)=>f===-1?6-i:null).filter(Boolean),open=shape.map((f,i)=>f===0?6-i:null).filter(Boolean);
 return (vi?'Bấm ':'Press ')+fretted.join('; ')+'. '+(open.length?(vi?'Dây buông: ':'Open strings: ')+open.join(', ')+'. ':'')+(skip.length?(vi?'Không gảy dây ':'Skip strings ')+skip.join(', ')+'. ':'')+(['Cm','Gm','F','Fm','F#','F#m','B','Bm','Bm7','Bb'].includes(chord)?(vi?'Dùng ngón trỏ chặn các dây cùng ngăn thấp nhất.':'Use your index finger as a barre across strings at the lowest fretted position.'):'');
}
root.MocPractice={shapes,normalize,parseSequence,parseChart,chartText,fillTiming,makeTimeline,detect,segments,fingering};
})(globalThis);
