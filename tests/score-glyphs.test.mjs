import test from 'node:test';import assert from 'node:assert/strict';
import '../public/score-glyphs.js';import '../public/note-engine.js';import '../public/chord-engine.js';
const glyphs=globalThis.MocScoreGlyphs,pg=globalThis.MocPractice;
test('isolates labels at the left edge and different baselines without staff/stem ink',()=>{
 const width=300,height=80,data=new Uint8ClampedArray(width*height*4).fill(255);
 function ink(x,y,w,h){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const i=(yy*width+xx)*4;data[i]=data[i+1]=data[i+2]=0;}}
 ink(8,20,12,18);ink(100,10,12,18);ink(114,14,11,14);ink(260,35,12,18);ink(70,65,4,15);ink(0,78,300,2);
 assert.deepEqual(glyphs.textRegions({width,height,data},50),[{x:8,y:20,width:12,height:18},{x:100,y:10,width:25,height:18},{x:260,y:35,width:12,height:18}]);
});
test('reads whole chord names without truncating suffixes or interpreting measure numbers',()=>{
 for(const chord of ['Am','Em','F','C','Am9','F#7','Bbmaj7','D/F#'])assert.equal(glyphs.chordToken(chord),chord);
 for(const other of ['18','23','Amn','Bored','F13','Emphasis',''])assert.equal(glyphs.chordToken(other),null);
 assert.equal(glyphs.chooseReading([{text:'18',confidence:96},{text:'Am',confidence:88}]).chord,'Am');
});
test('unmeasured staff labels do not become one printed bar per chord',()=>{
 const detected=pg.detect('Section 1\n[Am] [Em] [F] [C] [Am]');
 const chart=pg.chartText(detected.sections);assert.equal(chart.includes('|'),false);
 assert.deepEqual(pg.detect(chart,{allowSingle:true}).sequence,['Am','Em','F','C','Am']);
 assert.throws(()=>pg.makeTimeline(pg.parseChart(chart,{allowSingle:true}).sections,'3/4'),/duration/);
});
test('keeps two verified chord changes in the same 3/4 bar',()=>{
 const plan=pg.parseChart('Section 1\nF:1 Em:2 | Am:3',{strict:true});
 assert.equal(plan.sections[0].bars.length,2);assert.equal(plan.sections[0].bars[0].events.length,2);
 assert.equal(pg.makeTimeline(plan.sections,'3/4').total,6);
 assert.equal(pg.chartText(plan.sections),'Section 1\nF:1 Em:2 | Am:3');
});
