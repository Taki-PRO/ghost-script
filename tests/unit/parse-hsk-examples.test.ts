// Unit tests for parseHskExamples (task 15.1, Requirement 18.3).
import { describe, it, expect } from 'vitest';
import { parseHskExamples } from '../../scripts/lib/parse-hsk-examples.js';

const HEADER = 'Hanzi,Level,WritingLevel,Traditional,Freq,Examples';

describe('parseHskExamples', () => {
  it('reads the six fields and splits the Examples cell on whitespace', () => {
    const map = parseHskExamples(`${HEADER}\n鸟,3,1,鳥,1234,鸟 鸟巢\n读,1,2,讀,99,读 读书 读音\n`);
    expect(map.get('鸟')).toEqual(['鸟', '鸟巢']);
    expect(map.get('读')).toEqual(['读', '读书', '读音']);
    expect(map.size).toBe(2);
  });

  it('skips the header and rows with an empty WritingLevel', () => {
    const map = parseHskExamples(`${HEADER}\n的,1,,的,1,的 我的\n鸟,3,1,鳥,2,鸟\n`);
    expect(map.has('的')).toBe(false);
    expect(map.has('Hanzi')).toBe(false);
    expect([...map.keys()]).toEqual(['鸟']);
  });

  it('tolerates extra whitespace, CRLF line ends and blank lines', () => {
    const map = parseHskExamples(`${HEADER}\r\n\r\n胖,3,1,胖,5,  胖   胖子\t肥胖 \r\n`);
    expect(map.get('胖')).toEqual(['胖', '胖子', '肥胖']);
  });

  it('gives an empty list for an empty Examples cell and skips short lines', () => {
    const map = parseHskExamples(`${HEADER}\n鸟,3,1,鳥,2,\n坏,1,1\n`);
    expect(map.get('鸟')).toEqual([]);
    expect(map.has('坏')).toBe(false);
  });
});
