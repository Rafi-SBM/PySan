import { describe, expect, it } from 'vitest';
import { formatCount, formatPercent, formatSize, formatTimestamp } from './format';

describe('formatSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.00 KB'],
    [1536, '1.50 KB'],
    [1024 * 1024, '1.00 MB'],
    [15 * 1024 * 1024, '15.0 MB'],
    [250 * 1024 * 1024, '250 MB'],
    [3 * 1024 ** 3, '3.00 GB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatSize(bytes)).toBe(expected);
  });

  it('distinguishes an unmeasured size from a zero size', () => {
    expect(formatSize(null)).toBe('unknown');
    expect(formatSize(undefined)).toBe('unknown');
    expect(formatSize(0)).toBe('0 B');
  });

  it('caps at the largest known unit', () => {
    expect(formatSize(1024 ** 6)).toContain('TB');
  });
});

describe('formatCount', () => {
  it('pluralizes', () => {
    expect(formatCount(1, 'package')).toBe('1 package');
    expect(formatCount(2, 'package')).toBe('2 packages');
    expect(formatCount(3, 'match', 'matches')).toBe('3 matches');
  });

  it('groups large numbers', () => {
    expect(formatCount(1234, 'package')).toBe('1,234 packages');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percentages', () => {
    expect(formatPercent(1, 2)).toBe('50%');
    expect(formatPercent(1, 3)).toBe('33%');
  });

  it('does not round a non-zero share down to zero', () => {
    expect(formatPercent(1, 10000)).toBe('<1%');
    expect(formatPercent(0, 10000)).toBe('0%');
  });

  it('guards against an empty total', () => {
    expect(formatPercent(5, 0)).toBe('0%');
  });
});

describe('formatTimestamp', () => {
  it('returns null for missing or unparseable input', () => {
    expect(formatTimestamp(null)).toBeNull();
    expect(formatTimestamp('not a date')).toBeNull();
  });

  it('formats a valid ISO timestamp', () => {
    expect(formatTimestamp('2026-01-02T03:04:05Z')).toBeTruthy();
  });
});
