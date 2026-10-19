(function(root){
const open=[40,45,50,55,59,64];
function midiName(midi){return ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][midi%12]+(Math.floor(midi/12)-1)}
function noteToken(notes){return '@'+notes.map(midiName).join('+')}
function parseTabToken(token){
 if(!/^@[1-6]\/\d{1,2}(?:\+[1-6]\/\d{1,2})*$/.test(token))return null;
 const tab=token.slice(1).split('+').map(p=>{const [string,fret]=p.split('/').map(Number);return {string,fret}});
 if(tab.length>6||new Set(tab.map(p=>p.string)).size!==tab.length||tab.some(p=>p.fret>24))return null;
 return {tab,notes:tab.map(p=>open[6-p.string]+p.fret)};
}
function tabToken(tab){return '@'+tab.map(p=>p.string+'/'+p.fret).join('+')}
function eventToken(event){return event.tab?.length?tabToken(event.tab):event.notes?.length?noteToken(event.notes):event.chord}
function tabDirection(tab,language){return tab.map(p=>{const name=midiName(open[6-p.string]+p.fret);return language==='vi'?`${name}: dây ${p.string}, ${p.fret?'ngăn '+p.fret:'dây buông'}`:`${name}: string ${p.string}, ${p.fret?'fret '+p.fret:'open'}`}).join(' · ')}
function parseNoteToken(token){
 if(!/^@(?:[A-G](?:#|b)?[0-8])(?:\+[A-G](?:#|b)?[0-8])*$/.test(token))return null;
 const base={C:0,D:2,E:4,F:5,G:7,A:9,B:11};const values=token.slice(1).split('+').map(n=>{const m=n.match(/^([A-G])(#|b)?([0-8])$/);return (Number(m[3])+1)*12+base[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)});
 return values.length<=6&&values.every(n=>n>=40&&n<=88)?[...new Set(values)]:null;
}
function position(midi){return open.map((pitch,i)=>({string:6-i,fret:midi-pitch})).filter(p=>p.fret>=0&&p.fret<=24).sort((a,b)=>a.fret-b.fret||a.string-b.string)[0]}
function direction(midi,language){const p=position(midi);return p?(language==='vi'?`${midiName(midi)}: dây ${p.string}, ${p.fret?'ngăn '+p.fret:'dây buông'}`:`${midiName(midi)}: string ${p.string}, ${p.fret?'fret '+p.fret:'open'}`):''}
root.MocNotes={midiName,noteToken,parseNoteToken,parseTabToken,tabToken,eventToken,tabDirection,position,direction};
})(globalThis);
