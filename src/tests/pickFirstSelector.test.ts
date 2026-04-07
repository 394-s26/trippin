import { describe, it, expect } from 'vitest';
import { pickFirstSelector } from '../utilities/pickFirstSelector';
import { UserSelection } from '../hooks/useSessionSelections';

const sel = (uid: string, color: string, selectedIds: string[]): UserSelection => ({
  uid,
  color,
  selectedIds,
});

describe('pickFirstSelector', () => {
  it('returns undefined when no user selected the event', () => {
    const selections = [sel('a', '#f00', ['e2']), sel('b', '#0f0', ['e3'])];
    expect(pickFirstSelector(selections, 'e1')).toBeUndefined();
  });

  it('returns the only selector', () => {
    const selections = [sel('a', '#f00', ['e1', 'e2'])];
    expect(pickFirstSelector(selections, 'e1')).toEqual(selections[0]);
  });

  it('picks the user who added the event at a lower index', () => {
    const selections = [
      sel('a', '#f00', ['e5', 'e1']),
      sel('b', '#0f0', ['e1']),
    ];
    expect(pickFirstSelector(selections, 'e1')?.uid).toBe('b');
  });

  it('breaks ties by lexicographic uid', () => {
    const selections = [
      sel('z', '#f00', ['e1']),
      sel('a', '#0f0', ['e1']),
    ];
    expect(pickFirstSelector(selections, 'e1')?.uid).toBe('a');
  });

  it('excludes the specified uid', () => {
    const selections = [
      sel('me', '#f00', ['e1']),
      sel('other', '#0f0', ['e1', 'e2']),
    ];
    expect(pickFirstSelector(selections, 'e1', 'me')?.uid).toBe('other');
  });

  it('returns undefined when all selectors are excluded', () => {
    const selections = [sel('me', '#f00', ['e1'])];
    expect(pickFirstSelector(selections, 'e1', 'me')).toBeUndefined();
  });

  it('handles empty selections array', () => {
    expect(pickFirstSelector([], 'e1')).toBeUndefined();
  });
});
