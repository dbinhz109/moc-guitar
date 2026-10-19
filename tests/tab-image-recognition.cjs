// Original raster fixture generated at runtime; no copyrighted score is included.
const assert=require('node:assert/strict');const {chromium}=require(process.env.MOC_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.MOC_TEST_BASE_URL||'http://127.0.0.1:4173';assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
(async()=>{const browser=await chromium.launch({executablePath:process.env.MOC_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#library');await page.locator('#openAccount:not([disabled])').waitFor();await page.getByText('Guest files are saved only in this browser.',{exact:true}).waitFor();
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=2000;const g=canvas.getContext('2d');g.fillStyle='white';g.fillRect(0,0,1600,2000);g.strokeStyle='black';g.lineWidth=1;
  for(const [top,count] of [[200,5],[500,6]])for(let i=0;i<count;i++){g.beginPath();g.moveTo(80,top+20*i+.5);g.lineTo(1550,top+20*i+.5);g.stroke();}
  g.font='18px serif';g.textAlign='center';g.textBaseline='middle';
  for(const [x,string,fret] of [[200,1,4],[200,3,1],[400,2,0],[600,1,12],[800,4,2],[1000,6,0]]){const y=500+(string-1)*20;g.fillStyle='white';g.fillRect(x-14,y-10,28,20);g.fillStyle='black';g.fillText(String(fret),x,y);}
  return canvas.toDataURL();
 });
 await page.locator('#fileInput').setInputFiles({name:'original-tab-test.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});await page.locator('#readerLearn').click();await page.locator('#guideSequence:not([disabled])').waitFor({timeout:120000});
 const result=await page.evaluate(()=>({mode:guide.sourceMode,pending:MocTab.unresolved(guide.tabDraft),events:MocPractice.parseChart(guide.chart).sections[0].bars[0].events}));
 assert.equal(result.mode,'tab-ocr');assert.equal(result.pending,0);
 assert.deepEqual(result.events.map(e=>e.tab),[[{string:1,fret:4},{string:3,fret:1}],[{string:2,fret:0}],[{string:1,fret:12}],[{string:4,fret:2}],[{string:6,fret:0}]]);
 assert.ok(result.events.every(e=>e.chord==='-'&&e.beats===null));assert.equal(await page.locator('#createPractice').isDisabled(),true);
 await page.locator('#showTabMarkers').check();await page.locator('[data-tab-point="0-2"]').click();await page.locator('[data-tab-pairs="0-2"]:focus').waitFor();
 await page.locator('[data-tab-pairs="0-2"]').fill('1/25');await page.locator('[data-tab-pairs="0-2"]').press('Tab');assert.match(await page.locator('#tabEditError').textContent(),/0–24/);
 await page.locator('[data-tab-pairs="0-2"]').fill('1/12');await page.locator('[data-tab-pairs="0-2"]').press('Tab');
 for(const [i,bar,beats] of [[0,1,1],[1,1,2],[2,2,3],[3,3,3],[4,4,3]]){
  for(const [key,value] of [['bar',bar],['beats',beats]]){const field=page.locator(`[data-tab-${key}="0-${i}"]`);await field.fill(String(value));await field.press('Tab');}
 }
 await page.locator('#guideMeter').selectOption('3/4');await page.locator('#guideReviewed').check();await page.locator('#createPractice').click();await page.locator('#guidePlay').waitFor();
 assert.equal(await page.locator('.guide-bar').count(),4);assert.equal(await page.locator('.guide-bar').first().locator('.guide-chord').count(),2);
 assert.match(await page.locator('.note-positions').textContent(),/string 1, fret 12/);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS: clear image OCR reads all six positions, keeps simultaneous and double-digit frets, corrects entries, respects reviewed bars/durations and works on mobile.');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
