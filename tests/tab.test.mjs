import test from 'node:test';import assert from 'node:assert/strict';
import '../public/note-engine.js';import '../public/chord-engine.js';
import '../public/tab-engine.js';
const notes=globalThis.MocNotes,pg=globalThis.MocPractice;
test('TAB uses written string/fret positions and preserves simultaneous pitches across edits',()=>{
 const text='Section 1\n@1/4+3/1:? @2/0:? @1/12:?';
 const parsed=pg.parseChart(text,{strict:true});assert.deepEqual(parsed.invalid,[]);
 const events=parsed.sections[0].bars[0].events;
 assert.deepEqual(events[0],{chord:'-',notes:[68,56],tab:[{string:1,fret:4},{string:3,fret:1}],beats:null});
 assert.equal(pg.chartText(parsed.sections),text);
 assert.throws(()=>pg.makeTimeline(parsed.sections,'3/4'),/duration/);
 const drill=pg.fillTiming(parsed.sections,'3/4');assert.equal(pg.makeTimeline(drill,'3/4').total,9);
 assert.deepEqual(drill[0].bars[0].events[0].tab,events[0].tab);
 assert.equal(notes.parseTabToken('@1/25'),null);assert.equal(notes.parseTabToken('@7/0'),null);
 assert.equal(notes.parseTabToken('@1/4+1/5'),null);
 assert.deepEqual(notes.parseTabToken('@1/0+2/5').notes,[64,64]);
});
test('TAB timelines reject inconsistent pitches or impossible duplicate-string positions',()=>{
 const parsed=pg.parseChart('Section 1\n@1/4+3/1:3',{strict:true});assert.deepEqual(parsed.invalid,[]);
 assert.equal(pg.makeTimeline(parsed.sections,'3/4').total,3);
 parsed.sections[0].bars[0].events[0].notes=[65];assert.throws(()=>pg.makeTimeline(parsed.sections,'3/4'),/tab/);
});
test('ASCII TAB reads open strings, double digits and simultaneous positions without guessing rhythm',()=>{
 const {draft,warnings}=globalThis.MocTab.textTab('e|--0--12--\nB|--0------\nG|-----1---\nD|---------\nA|---------\nE|--0------');
 assert.deepEqual(warnings,[]);const sections=globalThis.MocTab.sections(draft);
 assert.deepEqual(sections[0].bars[0].events.map(e=>e.tab),[[{string:1,fret:0},{string:2,fret:0},{string:6,fret:0}],[{string:1,fret:12},{string:3,fret:1}]]);
 assert.ok(sections[0].bars[0].events.every(e=>e.beats===null));
 assert.throws(()=>pg.makeTimeline(sections,'3/4'),/duration/);
 assert.ok(globalThis.MocTab.textTab('e|--2h4--\nB|-------\nG|-------\nD|-------\nA|-------\nE|-------').warnings.includes('techniques'));
});
test('unknown TAB positions block the entire derived plan and bar edits survive serialization',()=>{
 const tab=globalThis.MocTab,draft=[{columns:[{positions:[{string:1,fret:4},{string:3,fret:null}],beats:null}]}];
 assert.equal(tab.unresolved(draft),1);assert.deepEqual(tab.sections(draft),[]);
 draft[0].columns[0].positions[1].fret=1;draft[0].columns[0].beats=1;draft[0].columns[0].bar=1;
 draft[0].columns.push({positions:[{string:2,fret:0}],beats:2,bar:1},{positions:[{string:1,fret:0}],beats:3,bar:2});
 const sections=tab.sections(draft);assert.equal(sections[0].bars.length,2);assert.equal(pg.makeTimeline(sections,'3/4').total,6);
 const reopened=pg.parseChart(pg.chartText(sections)).sections;assert.equal(pg.chartText(tab.sections(tab.fromSections(reopened))),pg.chartText(sections));
});
test('five-line staves and six-line TAB are distinguished before chord OCR',()=>{
 const width=600,height=1000,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const [top,count] of [[100,5],[200,6]])for(let l=0;l<count;l++)for(let x=40;x<580;x++){const i=((top+l*8)*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 const bands=globalThis.MocTab.staffBands({width,height,data});assert.deepEqual(bands.map(b=>b.lineCount),[5,6]);assert.ok(bands.every(b=>b.regular));
});
test('cropped six-line TAB does not depend on full page height',()=>{
 const width=600,height=100,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let l=0;l<6;l++)for(let x=40;x<580;x++){const i=((20+l*12)*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 assert.deepEqual(globalThis.MocTab.staffBands({width,height,data}).map(b=>b.lineCount),[6]);
});
test('widely spaced card borders are not six-line guitar TAB',()=>{
 const width=600,height=1000,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(let l=0;l<6;l++)for(let x=40;x<580;x++){const i=((180+l*70)*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 assert.deepEqual(globalThis.MocTab.staffBands({width,height,data}),[]);
});
test('a faint missing ruling retains the existing chord-label staff band',()=>{
 const width=376,height=531,data=new Uint8ClampedArray(width*height*4).fill(255);
 for(const y of [358,365,368,371,372])for(let x=24;x<360;x++){const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0;}
 const bands=globalThis.MocTab.staffBands({width,height,data});assert.equal(bands.length,1);assert.equal(bands[0].lineCount,4);assert.equal(bands[0].regular,false);
});
test('TAB bar numbering must be consecutive and bounded imports do not render oversized drafts',()=>{
 const tab=globalThis.MocTab;
 assert.equal(tab.validBars([{columns:[{bar:1},{bar:1},{bar:2}]}]),true);
 for(const values of [[2],[1,null],[1,3],[1,2,1]])assert.equal(tab.validBars([{columns:values.map(bar=>({bar}))}]),false);
 const body='--0'.repeat(513),empty='-'.repeat(body.length),text=['e|'+body,...['B','G','D','A','E'].map(s=>s+'|'+empty)].join('\n');
 assert.equal(tab.textTab(text).blocked,true);
});
