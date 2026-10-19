import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {zipSync,strToU8,unzipSync} from 'fflate';
import {readMusicXML,scoreDocument,unpackMusicXML} from '../public/musicxml.mjs';
import '../public/chord-engine.js';
import '../public/review-engine.js';
const pg=globalThis.MocPractice;
class Parser extends DOMParser{constructor(){super({onError:()=>{throw Error('xml')}})}}
const note=(step,duration=1,extra='')=>`<note>${extra}<pitch><step>${step}</step><octave>4</octave></pitch><duration>${duration}</duration><voice>1</voice></note>`;
const harmony=(root,kind='major',offset='')=>`<harmony><root><root-step>${root}</root-step></root><kind>${kind}</kind>${offset}</harmony>`;
const attr=(meter='2/4')=>`<attributes><divisions>1</divisions><time><beats>${meter.split('/')[0]}</beats><beat-type>${meter.split('/')[1]}</beat-type></time></attributes>`;
const score=measures=>`<?xml version="1.0"?><score-partwise version="4.0"><work><work-title>Test exercise</work-title></work><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list><part id="P1">${measures}</part></score-partwise>`;
const read=(xml,options={})=>readMusicXML(xml,{Parser,...options});
const events=result=>result.sections.flatMap(s=>s.bars.flatMap(b=>b.events));

test('reads exact harmony change times and carries a held chord across bars',()=>{
 const result=read(score(`<measure number="1">${attr()}<direction><sound tempo="72"/></direction>${harmony('C')}${note('E')}${harmony('G')}${note('G')}</measure><measure number="2">${note('G',2)}</measure>`));
 assert.equal(result.title,'Test exercise');assert.equal(result.partName,'Guitar');assert.equal(result.meter,'2/4');assert.equal(result.tempo,72);
 assert.deepEqual(events(result).map(e=>[e.chord,e.beats]),[['C',1],['G',1],['G',2]]);assert.equal(result.blocked,false);
 assert.equal(pg.makeTimeline(result.sections,'2/4').total,4);
});
test('preserves written notes, rests and saved note charts',()=>{
 const result=read(score(`<measure>${attr()}${note('E')}<note><rest/><duration>1</duration></note></measure>`),{mode:'notes'});
 assert.deepEqual(events(result),[{chord:'-',notes:[64],beats:1},{chord:'-',beats:1}]);
 const chart=pg.chartText(result.sections);assert.match(chart,/@E4:1 -:1/);
 assert.deepEqual(pg.makeTimeline(pg.parseChart(chart,{strict:true}).sections,'2/4'),pg.makeTimeline(result.sections,'2/4'));
});
test('uses divisions, harmony offsets, backup and selected voices',()=>{
 const xml=score(`<measure>${attr()}${harmony('C','major','<offset>1</offset>')}${note('E',2)}<backup><duration>2</duration></backup><note><pitch><step>A</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note></measure>`);
 assert.deepEqual(events(read(xml)).map(e=>[e.chord,e.beats]),[['-',1],['C',1]]);
 assert.deepEqual(events(read(xml,{mode:'notes',voice:'2'})),[{chord:'-',notes:[57],beats:2}]);
});
test('converts quarter-note tempo and durations to eighth-note counts for 6/8',()=>{
 const r=read(score(`<measure>${attr('6/8')}<sound tempo="60"/>${note('E',3)}</measure>`),{mode:'notes'});
 assert.equal(r.tempo,120);assert.equal(events(r)[0].beats,6);assert.equal(pg.makeTimeline(r.sections,'6/8').total,6);
});
test('keeps simultaneous note onsets and warns about out-of-range notes',()=>{
 const r=read(score(`<measure>${attr()}${note('E',2)}${note('G',2,'<chord/>')}</measure>`),{mode:'notes'});
 assert.deepEqual(events(r)[0].notes,[64,67]);assert.equal(events(r)[0].beats,2);
 assert.equal(read(score(`<measure>${attr()}<note><pitch><step>C</step><octave>1</octave></pitch><duration>2</duration></note></measure>`)).blocked,true);
});
test('applies instrument octave transposition and reads metronome-only tempos',()=>{
 const xml=score(`<measure>${attr()}<attributes><transpose><chromatic>0</chromatic><octave-change>-1</octave-change></transpose></attributes><direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>80</per-minute></metronome></direction-type></direction>${note('E',2)}</measure>`);
 const r=read(xml,{mode:'notes'});assert.equal(r.tempo,80);assert.deepEqual(events(r)[0].notes,[52]);assert.ok(r.warnings.includes('transposition'));
});
test('selects parts by id and avoids applying simple repeats to alternate endings',()=>{
 const xml=score(`<measure>${attr()}${note('E',2)}<barline><ending number="1" type="start"/><repeat direction="backward"/></barline></measure>`).replace('</part></score-partwise>',`</part><part id="P2"><measure>${attr()}${note('G',2)}</measure></part></score-partwise>`);
 assert.deepEqual(events(read(xml,{part:'P2',mode:'notes'}))[0].notes,[67]);
 const r=read(xml);assert.ok(r.warnings.includes('directions'));assert.equal(r.sections.flatMap(s=>s.bars).length,1);
});
test('expands simple repeats over more than four bars without losing the prefix',()=>{
 let bars=`<measure>${attr()}${harmony('C')}${note('E',2)}</measure>`;
 for(let i=0;i<6;i++)bars+=`<measure>${i===0?'<barline location="left"><repeat direction="forward"/></barline>':''}${harmony(i===5?'G':'A','minor')}${note('E',2)}${i===5?'<barline location="right"><repeat direction="backward" times="2"/></barline>':''}</measure>`;
 const r=read(score(bars));assert.equal(r.sections.flatMap(s=>s.bars).length,13);assert.equal(pg.makeTimeline(r.sections,'2/4').total,26);
});
test('flags missing chord symbols, pickups and meter changes instead of guessing',()=>{
 const xml=score(`<measure implicit="yes">${attr()}${note('E')}</measure><measure>${attr('3/4')}${note('G',3)}</measure>`);
 const r=read(xml,{mode:'chords'});assert.equal(r.blocked,true);assert.ok(r.warnings.includes('no-harmony'));assert.ok(r.warnings.includes('partial-bars'));assert.ok(r.warnings.includes('meter-changes'));assert.equal(r.meter,null);
});
test('loads compressed MusicXML with its declared root and rejects unrelated XML and entities',()=>{
 const xml=score(`<measure>${attr()}${note('E',2)}</measure>`);
 const zip=zipSync({'META-INF/container.xml':strToU8('<container><rootfiles><rootfile full-path="score.musicxml"/></rootfiles></container>'),'score.musicxml':strToU8(xml)});
 assert.equal(unpackMusicXML(zip,unzipSync,Parser),xml);
 assert.throws(()=>scoreDocument('<html><body>hi</body></html>',Parser),/xml-invalid/);
 assert.throws(()=>scoreDocument('<score-partwise><part></score-partwise>',Parser),/xml-invalid/);
 assert.throws(()=>scoreDocument('<!DOCTYPE a [<!ENTITY x "oops">]>'+xml,Parser),/xml-invalid/);
 assert.doesNotThrow(()=>scoreDocument('<!DOCTYPE score-partwise PUBLIC "test" "https://example.invalid/musicxml.dtd">'+xml,Parser));
 assert.throws(()=>unpackMusicXML(zipSync({'wrong.xml':strToU8(xml)}),unzipSync,Parser),/xml-container/);
 assert.throws(()=>unpackMusicXML(zipSync({'huge.xml':new Uint8Array(4*1024*1024+1)}),unzipSync,Parser),/xml-size/);
});
test('image corrections preserve timing and keep marker indexes aligned through insert and delete',()=>{
 const anchors=[{id:'a',index:0,chord:'C',x:.2,y:.1},{id:'b',index:1,chord:'G',x:.6,y:.1}];
 const edit=globalThis.MocReview.rewrite('Section 1\nC:1 G:1',anchors,{type:'edit',index:1,chord:'Am',beats:1});
 assert.equal(pg.makeTimeline(pg.parseChart(edit.chart).sections,'2/4').total,2);assert.equal(edit.anchors[1].chord,'Am');
 const add=globalThis.MocReview.rewrite(edit.chart,edit.anchors,{type:'add',index:1,chord:'F',beats:null,anchor:{id:'c',x:.4,y:.1}});
 assert.equal(add.anchors.find(a=>a.id==='b').index,2);
 const remove=globalThis.MocReview.rewrite(add.chart,add.anchors,{type:'delete',index:1});
 assert.equal(remove.anchors.find(a=>a.id==='b').index,1);assert.equal(remove.chart,edit.chart);assert.equal(anchors[1].chord,'G');
});
