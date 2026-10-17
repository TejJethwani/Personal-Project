import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { makeGame } from '@/engine/__tests__/helpers';
import { advanceWeek } from '@/engine/season/advance';
import { _resetDbForTests, AUTOSAVE_SLOT, autosaveSlotFor, deleteSlot, EURO_AUTOSAVE_SLOT, listSaves, loadFromSlot, manualSlotsFor, MANUAL_SLOTS, saveToSlot } from '../persistence';

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

describe('European League saves', () => {
  it('live in their own slots and never overwrite a Classic career', async () => {
    _resetDbForTests();
    const classic = makeGame(901);
    const euro = makeGame(902, { european: { assocId: 'ITA', race2Grid: 'qualifying' } });
    expect(autosaveSlotFor(classic)).toBe(AUTOSAVE_SLOT);
    expect(autosaveSlotFor(euro)).toBe(EURO_AUTOSAVE_SLOT);
    expect(manualSlotsFor(classic)).toEqual(MANUAL_SLOTS);
    expect(manualSlotsFor(euro).every((s) => s.startsWith('euro-'))).toBe(true);
    await saveToSlot(autosaveSlotFor(classic), classic);
    await saveToSlot(autosaveSlotFor(euro), euro);
    const list = await listSaves();
    const byslot = Object.fromEntries(list.map((s) => [s.slot, s]));
    expect(byslot[AUTOSAVE_SLOT].meta.mode).toBe('career');
    expect(byslot[EURO_AUTOSAVE_SLOT].meta.mode).toBe('european');
    expect(byslot[EURO_AUTOSAVE_SLOT].meta.league).toBe('Serie C Corse');
    const c = await loadFromSlot(AUTOSAVE_SLOT);
    const e = await loadFromSlot(EURO_AUTOSAVE_SLOT);
    expect(c.mode).not.toBe('european');
    expect(c.europe).toBeUndefined();
    expect(e.mode).toBe('european');
    expect(e.europe?.playerAssocId).toBe('ITA');
  });
});
