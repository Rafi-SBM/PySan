import { describe, expect, it } from 'vitest';
import { analyzeEnvironment } from './analyze';
import { parseEnvironmentData } from './parse';
import type { Package } from '../types';

interface Spec {
  requires?: string[];
  size?: number;
}

function env(spec: Record<string, Spec>): Package[] {
  return parseEnvironmentData(
    JSON.stringify({
      packages: Object.entries(spec).map(([name, value]) => ({
        name,
        version: '1.0',
        size: value.size ?? 100,
        requires: value.requires ?? [],
      })),
    }),
  ).packages;
}

const names = (decisions: { package: Package }[]) =>
  decisions.map((decision) => decision.package.id).sort();

describe('analyzeEnvironment', () => {
  it('keeps packages that match a selected profile', () => {
    const result = analyzeEnvironment(env({ pandas: {}, pygame: {} }), {
      profiles: ['data_science'],
    });

    expect(names(result.keep)).toContain('pandas');
    expect(names(result.remove)).toContain('pygame');
  });

  it('keeps a transitive dependency of a profile match even when no profile names it', () => {
    const packages = env({
      pandas: { requires: ['obscure-helper'] },
      'obscure-helper': { requires: ['deeper-helper'] },
      'deeper-helper': {},
      unrelated: {},
    });

    const result = analyzeEnvironment(packages, { profiles: ['data_science'] });

    expect(names(result.keep)).toEqual(['deeper-helper', 'obscure-helper', 'pandas']);
    expect(names(result.remove)).toEqual(['unrelated']);
    expect(result.stats.dependencyCount).toBe(2);
  });

  it('explains a dependency decision by naming what needs the package', () => {
    const result = analyzeEnvironment(
      env({ pandas: { requires: ['helper'] }, helper: {} }),
      { profiles: ['data_science'] },
    );

    const helper = result.byId.get('helper');
    expect(helper?.reason).toEqual({ kind: 'dependency', requiredBy: ['pandas'] });
  });

  it('never removes protected packaging tooling, whatever the profiles', () => {
    const result = analyzeEnvironment(env({ pip: {}, setuptools: {}, wheel: {}, random: {} }), {
      profiles: [],
    });

    expect(names(result.remove)).toEqual(['random']);
    expect(result.byId.get('pip')?.reason.kind).toBe('protected');
  });

  it('flags everything unmatched when no profile is selected', () => {
    const result = analyzeEnvironment(env({ pandas: {}, torch: {} }), { profiles: [] });
    expect(result.stats.removeCount).toBe(2);
  });

  it('does not let one name claim another by prefix', () => {
    // `six` is a shared-runtime package; `sixpack` must not inherit that.
    const result = analyzeEnvironment(env({ six: {}, sixpack: {} }), {
      profiles: ['shared_runtime'],
    });

    expect(names(result.keep)).toEqual(['six']);
    expect(names(result.remove)).toEqual(['sixpack']);
  });

  it('matches a namespace pattern across a vendor prefix', () => {
    const result = analyzeEnvironment(
      env({ 'azure-storage-blob': {}, azurerm: {} }),
      { profiles: ['devops'] },
    );

    expect(names(result.keep)).toEqual(['azure-storage-blob']);
    expect(names(result.remove)).toEqual(['azurerm']);
  });

  it('honours a manual keep and pulls in its dependencies', () => {
    const result = analyzeEnvironment(
      env({ mystery: { requires: ['mystery-dep'] }, 'mystery-dep': {} }),
      { profiles: [], overrides: { mystery: 'keep' } },
    );

    expect(names(result.keep)).toEqual(['mystery', 'mystery-dep']);
    expect(result.byId.get('mystery')?.reason.kind).toBe('user-keep');
  });

  it('honours a manual removal of a profile match', () => {
    const result = analyzeEnvironment(env({ pandas: {}, numpy: {} }), {
      profiles: ['data_science'],
      overrides: { pandas: 'remove' },
    });

    expect(names(result.remove)).toEqual(['pandas']);
    expect(result.byId.get('pandas')?.reason.kind).toBe('user-remove');
  });

  it('warns when a manual removal would break something kept', () => {
    const result = analyzeEnvironment(
      env({ pandas: { requires: ['numpy'] }, numpy: {} }),
      { profiles: ['data_science'], overrides: { numpy: 'remove' } },
    );

    expect(names(result.remove)).toEqual(['numpy']);
    expect(result.warnings.join(' ')).toMatch(/numpy \(needed by pandas\)/);
  });

  it('cannot be overridden into removing protected tooling', () => {
    const result = analyzeEnvironment(env({ pip: {} }), {
      profiles: [],
      overrides: { pip: 'remove' },
    });

    expect(result.stats.removeCount).toBe(0);
    expect(result.byId.get('pip')?.reason.kind).toBe('protected');
  });

  it('treats extras as removable by default and keeps them on request', () => {
    const packages = env({
      pandas: { requires: ["plotting-extra; extra == 'plot'"] },
      'plotting-extra': {},
    });

    expect(
      names(analyzeEnvironment(packages, { profiles: ['data_science'] }).remove),
    ).toEqual(['plotting-extra']);

    expect(
      names(
        analyzeEnvironment(packages, { profiles: ['data_science'], includeOptional: true })
          .remove,
      ),
    ).toEqual([]);
  });

  it('totals sizes on each side and overall', () => {
    const result = analyzeEnvironment(
      env({ pandas: { size: 300 }, pygame: { size: 700 } }),
      { profiles: ['data_science'] },
    );

    expect(result.stats).toMatchObject({
      totalPackages: 2,
      keepCount: 1,
      removeCount: 1,
      keepSize: 300,
      removeSize: 700,
      totalSize: 1000,
    });
  });

  it('counts packages whose size was never measured', () => {
    const packages = parseEnvironmentData('alpha==1\nbeta==2\n').packages;
    const result = analyzeEnvironment(packages, { profiles: [] });

    expect(result.stats.unsizedCount).toBe(2);
    expect(result.stats.removeSize).toBe(0);
  });

  it('sorts both lists by size, largest first', () => {
    const result = analyzeEnvironment(
      env({ small: { size: 10 }, large: { size: 9000 }, middle: { size: 500 } }),
      { profiles: [] },
    );

    expect(result.remove.map((decision) => decision.package.id)).toEqual([
      'large',
      'middle',
      'small',
    ]);
  });

  it('reports dependencies that are declared but not installed', () => {
    const result = analyzeEnvironment(env({ pandas: { requires: ['vanished>=1'] } }), {
      profiles: ['data_science'],
    });

    expect(result.missingDependencies).toEqual([{ name: 'vanished', requiredBy: ['pandas'] }]);
  });

  it('puts every package on exactly one side', () => {
    const packages = env({ a: {}, b: {}, pandas: {}, pip: {} });
    const result = analyzeEnvironment(packages, { profiles: ['data_science'] });

    expect(result.keep.length + result.remove.length).toBe(packages.length);
    expect(result.byId.size).toBe(packages.length);
  });

  it('handles an empty environment without throwing', () => {
    const result = analyzeEnvironment([], { profiles: ['data_science'] });
    expect(result.stats.totalPackages).toBe(0);
    expect(result.keep).toEqual([]);
    expect(result.remove).toEqual([]);
  });
});
