import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeGame } from '@/engine/__tests__/helpers';
import { advanceWeek } from '@/engine/season/advance';
import { _resetDbForTests, AUTOSAVE_SLOT, deleteSlot, listSaves, loadFromSlot, saveToSlot } from '../persistence';

describe('IndexedDB save slots', () => {
  it('saves, lists, loads and deletes careers', async () => {
    _resetDbForTests();
    const game = makeGame(808);
    advanceWeek(game);
    await saveToSlot('slot-1', game);
    await saveToSlot(AUTOSAVE_SLOT, game);
    const list = await listSaves();
    expect(list.map((s) => s.slot).sort()).toEqual([AUTOSAVE_SLOT, 'slot-1'].sort());
    expect(list[0].meta.teamName).toBe('Project Apex');
    const loaded = await loadFromSlot('slot-1');
    expect(loaded.week).toBe(game.week);
    expect(JSON.stringify({ ...loaded, savedAt: 0 })).toBe(JSON.stringify({ ...game, savedAt: 0 }));
    await deleteSlot('slot-1');
    expect((await listSaves()).map((s) => s.slot)).toEqual([AUTOSAVE_SLOT]);
    await expect(loadFromSlot('slot-1')).rejects.toThrow(/empty/);
  });
});
