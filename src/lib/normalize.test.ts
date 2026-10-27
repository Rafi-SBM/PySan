import { describe, expect, it } from 'vitest';
import { findMatch, matchesPattern, normalizeName } from './normalize';

describe('normalizeName', () => {
  it('lowercases and collapses separator runs per PEP 503', () => {
    expect(normalizeName('Zope.Interface')).toBe('zope-interface');
    expect(normalizeName('typing_extensions')).toBe('typing-extensions');
    expect(normalizeName('ruamel..yaml')).toBe('ruamel-yaml');
    expect(normalizeName('  Django  ')).toBe('django');
  });

  it('treats every spelling of a name as the same project', () => {
    const spellings = ['zope.interface', 'zope-interface', 'Zope_Interface', 'ZOPE.INTERFACE'];
    expect(new Set(spellings.map(normalizeName)).size).toBe(1);
  });
});

describe('matchesPattern', () => {
  it('matches exactly when the pattern has no wildcard', () => {
    expect(matchesPattern('six', 'six')).toBe(true);
    expect(matchesPattern('sixpack', 'six')).toBe(false);
    expect(matchesPattern('pipenv', 'pip')).toBe(false);
  });

  it('claims a namespace when the pattern ends in a wildcard', () => {
    expect(matchesPattern('azure-storage-blob', 'azure-*')).toBe(true);
    expect(matchesPattern('azure', 'azure-*')).toBe(true);
    expect(matchesPattern('azurerm', 'azure-*')).toBe(false);
  });

  it('matches the bare namespace name itself', () => {
    expect(matchesPattern('jupyter', 'jupyter*')).toBe(true);
    expect(matchesPattern('jupyterlab', 'jupyter*')).toBe(true);
  });
});

describe('findMatch', () => {
  it('returns the first matching pattern, or undefined', () => {
    expect(findMatch('pandas', ['numpy', 'pandas'])).toBe('pandas');
    expect(findMatch('requests', ['numpy', 'pandas'])).toBeUndefined();
  });
});
