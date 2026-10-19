import { DOMParser } from '@xmldom/xmldom';
import { unzipSync } from 'fflate';
import { scoreDocument, unpackMusicXML } from '../public/musicxml.mjs';

class StrictParser extends DOMParser {
  constructor() { super({onError: () => { throw new Error('xml-invalid'); }}); }
}

export function validMusicXML(ext: string, bytes: Uint8Array): boolean {
  try {
    if (ext === 'mxl') unpackMusicXML(bytes, unzipSync, StrictParser);
    else scoreDocument(new TextDecoder('utf-8', {fatal: true}).decode(bytes), StrictParser);
    return true;
  } catch { return false; }
}
