import { describe, it, expect, beforeEach } from 'vitest';
import { MAX_MAP_LOADS, getCount, incrementCount, isAtLimit } from './mapLoadCounter';

describe('mapLoadCounter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports 0 when nothing has been stored', () => {
    expect(getCount('user-a')).toBe(0);
    expect(isAtLimit('user-a')).toBe(false);
  });

  it('increments the count and persists across reads', () => {
    expect(incrementCount('user-a')).toBe(1);
    expect(incrementCount('user-a')).toBe(2);
    expect(getCount('user-a')).toBe(2);
  });

  it('tracks counts independently per uid', () => {
    incrementCount('user-a');
    incrementCount('user-a');
    incrementCount('user-b');
    expect(getCount('user-a')).toBe(2);
    expect(getCount('user-b')).toBe(1);
  });

  it('flags at-limit once the cap is reached', () => {
    localStorage.setItem('trippin:mapLoadCount:user-a', String(MAX_MAP_LOADS - 1));
    expect(isAtLimit('user-a')).toBe(false);
    incrementCount('user-a');
    expect(isAtLimit('user-a')).toBe(true);
  });

  it('treats missing or malformed values as 0', () => {
    localStorage.setItem('trippin:mapLoadCount:user-a', 'not-a-number');
    expect(getCount('user-a')).toBe(0);
  });

  it('returns 0 when uid is empty', () => {
    expect(getCount('')).toBe(0);
  });
});
