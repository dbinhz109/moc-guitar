import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/chord-engine.js';
const {detect,parseSequence,segments,fingering}=globalThis.MocPractice;
test('preserves repeated chord order and excludes lyric words',()=>{
 assert.deepEqual(detect('My song\nG D Em C\nA day in the sun\nG G C D').sequence,['G','D','Em','C','G','G','C','D']);
 assert.deepEqual(detect('A simple song.\nI love you.').sequence,[]);
});
test('reads inline chord brackets, annotations, tempo and meter',()=>{
 const result=detect('72 BPM 3/4\nVerse: [Am]Hello [F]there\nChorus: C | G | Am | F x2');
 assert.deepEqual(result.sequence,['Am','F','C','G','Am','F']);assert.equal(result.bpm,72);assert.equal(result.meter,'3/4');
});
test('keeps unsupported chords visible and validates edited progressions',()=>{
 const result=parseSequence('C Gadd9 Am F');assert.deepEqual(result.unsupported,['Gadd9']);assert.deepEqual(result.invalid,[]);
 assert.deepEqual(parseSequence('C <script> Am').invalid,['<script>']);
 assert.deepEqual(parseSequence('C / G / Am').invalid,['/','/']);
});
test('normalizes accidentals and slices practice without losing repeats',()=>{
 assert.deepEqual(parseSequence('G♭ F♯m').sequence,['F#','F#m']);
 assert.deepEqual(segments(['C','C','G','Am','F']),[['C','C','G','Am'],['F']]);
});
test('provides string/fret directions and flags guitar tab',()=>{
 assert.match(fingering('Em','en'),/string 5, fret 2/);assert.match(fingering('Am','vi'),/dây 2, ngăn 1/);
 assert.equal(detect('e|--0--2--3--|\nB|--1--3--0--|').hasTab,true);
});

test('handles chord names joined together by OCR on chord-only lines',()=>{
 assert.deepEqual(detect('Practice Song\nGD EmC\nAm C GG').sequence,['G','D','Em','C','Am','C','G','G']);
 assert.deepEqual(detect('BAD\nA beautiful day').sequence,[]);
});
