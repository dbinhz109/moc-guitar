// Optional real-image regression: no copyrighted source image is distributed in this repo.
const assert=require('node:assert/strict');
const path=require('node:path');
const reference=require('./fixtures/nhat-ky-reference.json');
const {chromium}=require(process.env.MOC_PLAYWRIGHT_MODULE||'playwright');
const imagePath=process.argv[2]||process.env.MOC_SCORE_IMAGE;
if(!imagePath)throw Error('Supply the original image path as argument or MOC_SCORE_IMAGE.');
const base=process.env.MOC_TEST_BASE_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MOC_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#library');await page.locator('#openAccount:not([disabled])').waitFor();await page.getByText('Guest files are saved only in this browser.',{exact:true}).waitFor();
  await page.locator('#fileInput').setInputFiles(path.resolve(imagePath));await page.locator('#readerLearn').click();await page.locator('#guideSequence:not([disabled])').waitFor({timeout:120000});
  const result=await page.evaluate(()=>({chart:guide.chart,raw:guide.raw,mode:guide.sourceMode,sections:MocPractice.parseChart(guide.chart,{allowSingle:true}).sections.map(s=>s.bars.flatMap(b=>b.events.map(e=>e.chord))),knownDurations:MocPractice.parseChart(guide.chart,{allowSingle:true}).sections.flatMap(s=>s.bars.flatMap(b=>b.events)).filter(e=>e.beats!==null).length}));
  console.log(JSON.stringify(result,null,2));
  assert.deepEqual(result.sections,reference.sections,'OCR must preserve every user-reviewed label, its staff and order.');
  assert.equal(result.chart.includes('|'),false,'Unmeasured chord labels must not be presented as one bar per chord.');
  assert.equal(await page.locator('[data-anchor]').count(),30,'All recognized labels should remain editable at their source positions.');
  assert.equal(result.knownDurations,0,'Do not invent chord durations.');assert.equal(await page.locator('#createPractice').isDisabled(),true);
  await page.locator('#guideMeter').selectOption(reference.meter);await page.locator('#guideReviewed').check();assert.equal(await page.locator('#createPractice').isDisabled(),true,'Choosing 3/4 does not supply chord durations.');
  // A source with two chords inside one 3/4 bar is valid when timing is explicitly entered.
  await page.locator('#guideSequence').fill('Section 1\nF:1 G:2 | Am:3');await page.locator('#guideReviewed').check();await page.locator('#createPractice').click();await page.locator('#guidePlay').waitFor();
  assert.equal(await page.locator('.guide-bar').count(),2);assert.equal(await page.locator('.guide-bar').first().locator('.guide-chord').count(),2);assert.deepEqual(errors,[]);
  console.log('PASS: all 30 chord labels in 5 staff systems; unknown timing stays blocked; two chords per 3/4 bar remain intact.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
