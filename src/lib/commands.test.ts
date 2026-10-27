import { describe, expect, it } from 'vitest';
import { buildCommandPlan, chunkNames, renderScript } from './commands';
import type { Package } from '../types';

function pkgs(...names: string[]): Package[] {
  return names.map((name) => ({
    name,
    id: name,
    version: '1.0',
    size: 1,
    files: 1,
    requires: [],
    editable: false,
    location: null,
  }));
}

describe('chunkNames', () => {
  it('keeps a short list in a single chunk', () => {
    expect(chunkNames(['a', 'b', 'c'], 20)).toEqual([['a', 'b', 'c']]);
  });

  it('splits a list that would exceed the command length budget', () => {
    const names = Array.from({ length: 500 }, (_, index) => `package-name-${index}`);
    const chunks = chunkNames(names, 30);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat()).toEqual(names);
    for (const chunk of chunks) {
      expect(chunk.join(' ').length).toBeLessThan(6100);
    }
  });

  it('never produces an empty chunk, even for one very long name', () => {
    const chunks = chunkNames(['x'.repeat(9000)], 30);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(1);
  });

  it('returns nothing for an empty list', () => {
    expect(chunkNames([], 30)).toEqual([]);
  });
});

describe('buildCommandPlan', () => {
  it('builds a pip plan with backup, file form and restore', () => {
    const plan = buildCommandPlan(pkgs('numpy', 'pandas'), 'pip', 'posix');

    expect(plan.backup).toBe('python -m pip freeze > requirements.backup.txt');
    expect(plan.inline).toEqual(['python -m pip uninstall --yes numpy pandas']);
    expect(plan.fromFile).toBe('python -m pip uninstall --yes -r pysan-remove.txt');
    expect(plan.restore).toBe('python -m pip install -r requirements.backup.txt');
    expect(plan.chunked).toBe(false);
  });

  it('uses the right verb for each package manager', () => {
    expect(buildCommandPlan(pkgs('x'), 'uv', 'posix').inline[0]).toBe('uv pip uninstall x');
    expect(buildCommandPlan(pkgs('x'), 'poetry', 'posix').inline[0]).toBe('poetry remove x');
    expect(buildCommandPlan(pkgs('x'), 'pipenv', 'posix').inline[0]).toBe('pipenv uninstall x');
    expect(buildCommandPlan(pkgs('x'), 'conda', 'posix').inline[0]).toBe(
      'conda remove --yes x',
    );
  });

  it('backs up and restores conda environments with conda', () => {
    const plan = buildCommandPlan(pkgs('x'), 'conda', 'posix');
    expect(plan.backup).toBe('conda list --export > requirements.backup.txt');
    expect(plan.restore).toBe('conda install --yes --file requirements.backup.txt');
  });

  it('expands the file list per shell for managers without an -r flag', () => {
    expect(buildCommandPlan(pkgs('x'), 'poetry', 'posix').fromFile).toContain('$(cat ');
    expect(buildCommandPlan(pkgs('x'), 'poetry', 'powershell').fromFile).toContain(
      'Get-Content',
    );
  });

  it('flags a plan that had to be split', () => {
    const many = pkgs(...Array.from({ length: 400 }, (_, i) => `a-rather-long-name-${i}`));
    const plan = buildCommandPlan(many, 'pip', 'posix');

    expect(plan.chunked).toBe(true);
    expect(plan.inline.length).toBeGreaterThan(1);
  });
});

describe('renderScript', () => {
  it('comments the script for the chosen shell', () => {
    const plan = buildCommandPlan(pkgs('x'), 'pip', 'posix');
    expect(renderScript(plan, 'posix')).toContain('# 1. Record');
    expect(renderScript(plan, 'cmd')).toContain('REM 1. Record');
  });
});
