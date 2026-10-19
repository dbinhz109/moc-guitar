// Optional real-image regression. Supply a score + TAB image; the source is not distributed.
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.MOC_PLAYWRIGHT_MODULE||'playwright');
const image=process.argv[2];if(!image)throw Error('Supply the score + TAB image path.');
const base=process.env.MOC_TEST_BASE_URL||'http://127.0.0.1:4173';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.MOC_CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#library');await page.locator('#openAccount:not([disabled])').waitFor();
  await page.getByText('Guest files are saved only in this browser.',{exact:true}).waitFor();
  await page.locator('#fileInput').setInputFiles(path.resolve(image));await page.locator('#readerLearn').click();
  await page.locator('#guideSequence:not([disabled])').waitFor({timeout:120000});
  const result=await page.evaluate(()=>({chart:guide.chart,mode:guide.sourceMode,structure:guide.scoreStructure,lines:guide.tabDraft.length,pending:MocTab.unresolved(guide.tabDraft)}));console.log(result);
  assert.equal(result.chart,'','Unresolved notation must not produce a partial plan or F chords.');
  assert.equal(result.mode,'tab-ocr');assert.equal(result.lines,4);assert.ok(result.pending>0);
  assert.deepEqual(result.structure,{staves:4,tablatures:4});
  assert.match(await page.locator('.guide-notice').textContent(),/unresolved/);
  assert.match(await page.locator('.plan-pane').textContent(),/not measure numbers/);
  assert.equal(await page.locator('[data-anchor]').count(),0);
  await page.locator('#guideMeter').selectOption('3/4');await page.locator('#simplifyTiming').click();await page.locator('#guideReviewed').check();
  assert.equal(await page.locator('#createPractice').isDisabled(),true);
  await page.locator('#language').selectOption('vi');
  assert.match(await page.locator('.guide-notice').textContent(),/chưa đọc chắc chắn/);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#language').selectOption('en');
  // Plain text TAB exercises the same string/fret -> note -> review -> save/play path without OCR ambiguity.
  await page.locator('details').filter({has:page.locator('#guideSource')}).evaluate(el=>el.open=true);
  await page.locator('#guideSource').fill('e|--0--2--4--7--|\nB|--0-----------|\nG|--------1-----|\nD|--------------|\nA|--------------|\nE|--0-----------|');
  await page.locator('#detectChords').click();assert.equal(await page.locator('[data-tab-pairs]').count(),4);
  await page.locator('[data-tab-pairs="0-0"]').fill('1/4+3/1');await page.locator('[data-tab-pairs="0-0"]').press('Tab');
  assert.match(await page.locator('#guideSequence').inputValue(),/@1\/4\+3\/1:\?/);
  assert.equal(await page.locator('#createPractice').isDisabled(),true);
  await page.locator('#guideMeter').selectOption('3/4');await page.locator('#simplifyTiming').click();await page.locator('#guideReviewed').check();await page.locator('#createPractice').click();
  await page.locator('#guidePlay').waitFor();assert.equal(await page.locator('.guide-bar').count(),4);
  assert.match(await page.locator('.note-positions').textContent(),/G#4: string 1, fret 4/);
  assert.match(await page.locator('.note-positions').textContent(),/G#3: string 3, fret 1/);
  await page.evaluate(()=>{window.tabFrequencies=[];const play=tone;tone=(...args)=>{tabFrequencies.push(args[0]);return play(...args)}});
  await page.locator('#guidePlay').click();await page.waitForTimeout(400);await page.locator('#guidePlay').click();
  const frequencies=await page.evaluate(()=>tabFrequencies);assert.ok(frequencies.some(f=>Math.abs(f-415.3047)<.1));assert.ok(frequencies.some(f=>Math.abs(f-207.6523)<.1));
  await page.locator('#closePractice').click();await page.locator('.document-row').filter({hasText:path.basename(image)}).locator('[data-practice]').click();
  await page.locator('#createPractice:not([disabled])').waitFor();assert.match(await page.locator('[data-tab-pairs="0-0"]').inputValue(),/1\/4\+3\/1/);
  assert.deepEqual(errors,[]);console.log('PASS: source + TAB classified separately, unread symbols blocked, string/fret editing, simultaneous pitches, playback, saved positions, Vietnamese and mobile.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
