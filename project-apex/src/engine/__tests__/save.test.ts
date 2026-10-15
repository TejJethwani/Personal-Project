import { describe, expect, it } from 'vitest';
import { deserializeGame, SaveFormatError, serializeGame } from '../save/serialization';
import { advanceWeek } from '../season/advance';
import { makeGame } from './helpers';

describe('save and load', () => {
  it('round-trips a game exactly', () => {
    const s = makeGame(70);
    advanceWeek(s);
    advanceWeek(s);
    const text = serializeGame(s);
    const loaded = deserializeGame(text);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(s));
  });

  it('a loaded game continues identically to the original', () => {
    const a = makeGame(71);
    advanceWeek(a);
    const b = deserializeGame(serializeGame(a));
    for (let i = 0; i < 3 && a.phase === 'season'; i++) {
      advanceWeek(a);
      advanceWeek(b);
    }
    const strip = (x: typeof a) => JSON.stringify({ ...x, savedAt: 0 });
    expect(strip(b)).toBe(strip(a));
  });

  it('rejects tampered, foreign and invalid files', () => {
    const s = makeGame(72);
    const text = serializeGame(s);
    const tampered = text.replace(`"cash":${s.teams[s.player.teamId].cash}`, '"cash":999999999');
    expect(() => deserializeGame(tampered)).toThrow(SaveFormatError);
    expect(() => deserializeGame('{"hello":1}')).toThrow(/not a PROJECT APEX save/);
    expect(() => deserializeGame('not json')).toThrow(/not valid JSON/);
  });
});
