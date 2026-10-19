// Shared, bounded MusicXML reading. The server supplies its DOMParser; browsers use theirs.
import './note-engine.js';
export const {midiName,noteToken,parseNoteToken}=globalThis.MocNotes;
export const XML_EXTENSIONS = ['xml', 'musicxml', 'mxl'];
const LIMIT = 4 * 1024 * 1024;
const children = (node, name) => Array.from(node?.childNodes || []).filter(n => n.nodeType === 1 && (!name || n.localName === name || n.nodeName === name));
const child = (node, name) => children(node, name)[0];
const text = (node, name) => (name ? child(node, name) : node)?.textContent?.trim() || '';
const number = (node, name, fallback = 0) => text(node, name) === '' ? fallback : Number(text(node, name));
const all = (node, name) => Array.from(node?.getElementsByTagName('*') || []).filter(n => n.localName === name || n.nodeName === name);
const round = n => Math.round(n * 1e6) / 1e6;

export function xmlDocument(input, Parser = globalThis.DOMParser) {
  if (typeof input !== 'string' || input.length > LIMIT || /<!ENTITY\b|<!DOCTYPE[^>]*\[/i.test(input)) throw Error('xml-invalid');
  let elements=0;for(const match of input.matchAll(/<[A-Za-z_]/g)){if(++elements>30000)throw Error('xml-size');}
  // Standard MusicXML files often declare an external DTD. Never resolve it.
  const clean = input.replace(/<!DOCTYPE[^>]*>/gi, '');
  let doc;
  try { doc = new Parser().parseFromString(clean, 'application/xml'); } catch { throw Error('xml-invalid'); }
  if (!doc?.documentElement || all(doc, 'parsererror').length || doc.documentElement.localName === 'parsererror') throw Error('xml-invalid');
  return doc;
}

export function scoreDocument(input, Parser) {
  const doc = xmlDocument(input, Parser);
  if (doc.documentElement.localName !== 'score-partwise') throw Error(doc.documentElement.localName === 'score-timewise' ? 'xml-timewise' : 'xml-invalid');
  if (!children(doc.documentElement, 'part').length) throw Error('xml-invalid');
  return doc;
}

export function unpackMusicXML(bytes, unzip, Parser) {
  if (!(bytes instanceof Uint8Array) || bytes.length > 10 * 1024 * 1024) throw Error('xml-size');
  let expanded = 0, count = 0;
  const archive = unzip(bytes, {filter: entry => {
    count++; expanded += entry.originalSize;
    if (count > 200 || expanded > LIMIT || !Number.isFinite(expanded)) throw Error('xml-size');
    return !entry.name.endsWith('/') && /\.(xml|musicxml)$/i.test(entry.name);
  }});
  const containerBytes = archive['META-INF/container.xml'];
  if (!containerBytes) throw Error('xml-container');
  const decoder = new TextDecoder('utf-8', {fatal: true});
  const container = xmlDocument(decoder.decode(containerBytes), Parser);
  if (container.documentElement.localName !== 'container') throw Error('xml-container');
  const path = all(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!path || path.startsWith('/') || path.split('/').includes('..') || !archive[path]) throw Error('xml-container');
  const result = decoder.decode(archive[path]);
  scoreDocument(result, Parser);
  return result;
}

const kinds = {major:'', minor:'m', dominant:'7', 'major-seventh':'maj7', 'minor-seventh':'m7', 'major-sixth':'6', 'minor-sixth':'m6', diminished:'dim', 'diminished-seventh':'dim7', augmented:'aug', 'suspended-second':'sus2', 'suspended-fourth':'sus4', 'major-ninth':'maj9', 'minor-ninth':'m9', 'dominant-ninth':'9'};
function pitchClass(step, alter) {
  if (!/^[A-G]$/.test(step) || !Number.isInteger(alter) || Math.abs(alter) > 1) return null;
  return step + (alter === 1 ? '#' : alter === -1 ? 'b' : '');
}
function harmonyName(node) {
  const kind = text(node, 'kind');
  if (kind === 'none') return '-';
  const root = child(node, 'root'), bass = child(node, 'bass');
  const name = pitchClass(text(root, 'root-step'), number(root, 'root-alter'));
  if (!name || !(kind in kinds) || children(node, 'degree').length) return '?';
  const low = bass && pitchClass(text(bass, 'bass-step'), number(bass, 'bass-alter'));
  return name + kinds[kind] + (low ? '/' + low : '');
}

export function readMusicXML(input, options = {}) {
  const doc = scoreDocument(input, options.Parser), root = doc.documentElement;
  const nodes = children(root, 'part');
  const partNames = new Map(children(child(root, 'part-list'), 'score-part').map(p => [p.getAttribute('id'), text(p, 'part-name')]));
  const parts = nodes.map((p, i) => ({id:p.getAttribute('id') || String(i), name:partNames.get(p.getAttribute('id')) || `Part ${i+1}`, harmony:all(p, 'harmony').length > 0, voices:[...new Set(all(p,'note').map(n => text(n,'voice') || '1'))]}));
  const selected = parts.findIndex(p => p.id === options.part);
  const pi = selected < 0 ? Math.max(0, parts.findIndex(p => p.harmony)) : selected;
  const part = parts[pi], node = nodes[pi], mode = options.mode || (part.harmony ? 'chords' : 'notes'), voice = options.voice || part.voices[0] || '1';
  const warnings = new Set(), measures = [], meters = new Set();
  let divisions = 1, meter = '', beatType = 4, tempo = null, previousChord = '-', transposition = 0;
  const measureNodes = children(node, 'measure');
  if (measureNodes.length > 256) throw Error('xml-size');
  for (const [mi, measure] of measureNodes.entries()) {
    let cursor = 0, extent = 0, lastStart = 0;
    const harmonies = [], notes = [];
    for (const element of children(measure)) {
      const tag = element.localName;
      if (tag === 'attributes') {
        divisions = number(element, 'divisions', divisions);
        if (!Number.isFinite(divisions) || divisions <= 0) throw Error('xml-invalid');
        const time = child(element, 'time');
        if (time) { meter = text(time,'beats')+'/'+text(time,'beat-type'); beatType = number(time,'beat-type'); meters.add(meter); }
        const transpose=child(element,'transpose');
        if(transpose){transposition=number(transpose,'chromatic')+12*number(transpose,'octave-change');if(transposition)warnings.add('transposition');}
      }
      if (tag === 'direction' || tag === 'sound') {
        const sound = tag === 'sound' ? element : child(element,'sound');
        const metronome=all(element,'metronome')[0];
        const beatLength={whole:4,half:2,quarter:1,eighth:.5,'16th':.25}[text(metronome,'beat-unit')];
        const dots=children(metronome,'beat-unit-dot').length;
        const value = Number(sound?.getAttribute('tempo')) || (number(metronome,'per-minute')*(beatLength||0)*(2-2**(-dots)));
        if (value > 0) { const clicks = value * beatType / 4; if (tempo === null) tempo = round(clicks); else if (Math.abs(tempo-clicks)>.01) warnings.add('tempo-changes'); }
        if (all(element,'segno').length || all(element,'coda').length || sound?.getAttribute('dacapo') || sound?.getAttribute('dalsegno')) warnings.add('directions');
      }
      const unit = beatType / 4 / divisions;
      if (tag === 'harmony') harmonies.push({at:round(cursor + number(element,'offset')*unit), chord:harmonyName(element)});
      if (tag === 'backup' || tag === 'forward') {
        const duration = number(element,'duration')*unit;
        if (!Number.isFinite(duration) || duration < 0) throw Error('xml-invalid');
        cursor += tag === 'backup' ? -duration : duration;
        if (cursor < -.001) throw Error('xml-invalid');
        extent = Math.max(extent,cursor);
      }
      if (tag === 'note' && !child(element,'grace')) {
        const duration = number(element,'duration')*unit;
        if (!Number.isFinite(duration) || duration <= 0) throw Error('xml-invalid');
        const start = child(element,'chord') ? lastStart : cursor;
        if (!child(element,'chord')) { lastStart=start; cursor+=duration; }
        extent = Math.max(extent,start+duration);
        if ((text(element,'voice') || '1') === voice && !child(element,'rest')) {
          const pitch = child(element,'pitch'), base = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}[text(pitch,'step')];
          const midi = (number(pitch,'octave')+1)*12 + base + number(pitch,'alter') + transposition;
          if (!Number.isInteger(midi) || midi<40 || midi>88) warnings.add('note-range');
          notes.push({start:round(start),end:round(start+duration),midi});
        }
      }
    }
    const count = Number(meter.split('/')[0]);
    if (!['2/4','3/4','4/4','6/8'].includes(meter)) warnings.add('meter');
    const length = measure.getAttribute('implicit') === 'yes' && extent > 0 ? round(extent) : count;
    if (length !== count || extent > count+.001) warnings.add('partial-bars');
    let events=[];
    if (mode === 'chords') {
      const changes = harmonies.sort((a,b)=>a.at-b.at);
      let at = 0, current = previousChord;
      for (const change of changes) {
        if (change.at < -.001 || change.at > length || change.at < at) { warnings.add('harmony-timing'); continue; }
        if (change.at>at) events.push({chord:current,beats:round(change.at-at)});
        current=change.chord;at=change.at;
      }
      if (length>at) events.push({chord:current,beats:round(length-at)});
      previousChord=current;
      if (events.some(e=>e.chord==='?')) warnings.add('harmony-kind');
    } else {
      const boundaries=[...new Set([0,length,...notes.flatMap(n=>[n.start,n.end])])].filter(n=>Number.isFinite(n)&&n>=0&&n<=length).sort((a,b)=>a-b);
      for(let i=0;i<boundaries.length-1;i++){
        const start=boundaries[i],end=boundaries[i+1];
        const pitches=[...new Set(notes.filter(n=>n.start<=start+.00001&&n.end>start+.00001).map(n=>n.midi))].sort((a,b)=>a-b);
        events.push({chord:'-',...(pitches.length?{notes:pitches}:{}),beats:round(end-start)});
      }
    }
    if (events.length>16) warnings.add('dense-bars');
    const barlines=children(measure,'barline');
    const forward=barlines.some(b=>child(b,'repeat')?.getAttribute('direction')==='forward');
    const backward=barlines.map(b=>child(b,'repeat')).find(r=>r?.getAttribute('direction')==='backward');
    if(barlines.some(b=>child(b,'ending')))warnings.add('directions');
    measures.push({number:measure.getAttribute('number') || String(mi+1),events,forward,repeat:backward?Math.min(8,Math.max(2,Number(backward.getAttribute('times'))||2)):1});
  }
  if(meters.size>1)warnings.add('meter-changes');
  if(mode==='chords'&&!part.harmony)warnings.add('no-harmony');
  const sections=[];let bars=[];
  function flush(repeat=1){if(bars.length){sections.push({name:`Section ${sections.length+1}`,repeat,bars});bars=[];}}
  const playback=[];let repeatStart=0;
  for(let i=0;i<measures.length;i++){
    const measure=measures[i];if(measure.forward)repeatStart=i;
    playback.push(measure);
    if(measure.repeat>1&&!warnings.has('directions')){for(let r=1;r<measure.repeat;r++)playback.push(...measures.slice(repeatStart,i+1));repeatStart=i+1;warnings.add('repeats-expanded');}
  }
  for(const measure of playback){bars.push({events:measure.events,explicit:true});if(bars.length===4)flush();}
  flush();
  const blocked=['meter','meter-changes','partial-bars','harmony-timing','dense-bars','note-range','no-harmony','harmony-kind'].some(w=>warnings.has(w));
  const title=text(child(root,'work'),'work-title')||text(root,'movement-title')||'MusicXML';
  return {title,parts,part:part.id,partName:part.name,mode,voice,sections,measures,meter:meters.size===1&&['2/4','3/4','4/4','6/8'].includes(meter)?meter:null,tempo,blocked,warnings:[...warnings],noteCount:measures.reduce((n,b)=>n+b.events.filter(e=>e.notes?.length).length,0)};
}
