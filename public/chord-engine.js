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
function detect(text){
 const sequence=[];let confidence='none';
 for(const line of String(text).slice(0,200000).split(/\r?\n/)){
   const bracketed=[...line.matchAll(new RegExp('\\[('+chordSource+')\\]','g'))].map(m=>normalize(m[1]));
   if(bracketed.length){sequence.push(...bracketed);confidence='chords';continue;}
   const clean=line.replace(/^(?:intro|verse|chorus|bridge|outro|điệp khúc|đoạn|hợp âm|chords?)\s*\d*\s*:?/i,'').replace(/\b(?:x|×)\s*\d+\b/gi,'').trim();
   const rawTokens=clean.replace(/[|,;·→–—]/g,' ').split(/\s+/).filter(Boolean);
   const tokens=rawTokens.flatMap(token=>{const normalized=normalize(token);if(exact.test(normalized))return [normalized];if(rawTokens.length>1 && new RegExp('^(?:'+chordSource+')+$').test(normalized))return normalized.match(new RegExp(chordSource,'g')).map(normalize);return [normalized]});
   if(tokens.length && tokens.every(token=>exact.test(normalize(token)))){
     // Single-letter words in prose are ambiguous; only accept isolated single chords when extended (Am, G7…).
     if(tokens.length===1 && tokens[0].length===1)continue;
     sequence.push(...tokens.map(normalize));confidence='chords';
   }
 }
 const time=text.match(/\b([2346])\s*\/\s*([48])\b/);
 const tempo=text.match(/\b(\d{2,3})\s*(?:BPM|bpm)\b/);
 return {sequence:sequence.slice(0,256),confidence,unsupported:[...new Set(sequence.filter(c=>!shapes[c]))],meter:time?`${time[1]}/${time[2]}`:null,bpm:tempo&&+tempo[1]>=40&&+tempo[1]<=180?+tempo[1]:null,hasTab:/^[eBGDAE]\s*\|[-\d|hpbr~\/\\]+/m.test(text)};
}
function segments(sequence,size=4){const result=[];for(let i=0;i<sequence.length;i+=size)result.push(sequence.slice(i,i+size));return result}
function fingering(chord,language){const shape=shapes[chord];if(!shape)return '';
 const vi=language==='vi';const fretted=shape.map((f,i)=>f>0?(vi?`dây ${6-i}, ngăn ${f}`:`string ${6-i}, fret ${f}`):null).filter(Boolean);
 const skip=shape.map((f,i)=>f===-1?6-i:null).filter(Boolean),open=shape.map((f,i)=>f===0?6-i:null).filter(Boolean);
 return (vi?'Bấm ':'Press ')+fretted.join('; ')+'. '+(open.length?(vi?'Dây buông: ':'Open strings: ')+open.join(', ')+'. ':'')+(skip.length?(vi?'Không gảy dây ':'Skip strings ')+skip.join(', ')+'. ':'')+(['Cm','Gm','F','Fm','F#','F#m','B','Bm','Bm7','Bb'].includes(chord)?(vi?'Dùng ngón trỏ chặn các dây cùng ngăn thấp nhất.':'Use your index finger as a barre across strings at the lowest fretted position.'):'');
}
root.MocPractice={shapes,normalize,parseSequence,detect,segments,fingering};
})(globalThis);
