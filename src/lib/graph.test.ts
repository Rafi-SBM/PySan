import { describe, expect, it } from 'vitest';
import { buildDependencyGraph, newlyOrphaned, transitiveClosure } from './graph';
import { parseEnvironmentData } from './parse';
import type { Package } from '../types';

function env(
  spec: Record<string, string[]>,
): Package[] {
  return parseEnvironmentData(
    JSON.stringify({
      packages: Object.entries(spec).map(([name, requires]) => ({
        name,
        version: '1.0',
        size: 100,
        requires,
      })),
    }),
  ).packages;
}

describe('buildDependencyGraph', () => {
  it('records forward and reverse edges', () => {
    const graph = buildDependencyGraph(env({ app: ['lib'], lib: [], other: ['lib'] }));

    expect(graph.requires.get('app')).toEqual(['lib']);
    expect(graph.requiredBy.get('lib')).toEqual(['app', 'other']);
    expect(graph.requiredBy.get('app')).toBeUndefined();
  });

  it('separates extra-gated requirements from hard ones', () => {
    const graph = buildDependencyGraph(
      env({ app: ['lib', "extra-only; extra == 'dev'"], lib: [], 'extra-only': [] }),
    );

    expect(graph.requires.get('app')).toEqual(['lib']);
    expect(graph.optionalRequires.get('app')).toEqual(['extra-only']);
    expect(graph.requiredBy.get('extra-only')).toBeUndefined();
  });

  it('records requirements that are declared but not installed', () => {
    const graph = buildDependencyGraph(env({ app: ['absent>=1'] }));

    expect(graph.missing.get('absent')).toEqual(['app']);
    expect(graph.requires.get('app')).toEqual([]);
  });

  it('ignores a self-requirement', () => {
    const graph = buildDependencyGraph(env({ app: ['app'] }));
    expect(graph.requires.get('app')).toEqual([]);
  });

  it('deduplicates repeated requirements', () => {
    const graph = buildDependencyGraph(env({ app: ['lib>=1', 'lib<3'], lib: [] }));
    expect(graph.requires.get('app')).toEqual(['lib']);
    expect(graph.requiredBy.get('lib')).toEqual(['app']);
  });
});

describe('transitiveClosure', () => {
  it('follows requirement chains', () => {
    const graph = buildDependencyGraph(
      env({ app: ['mid'], mid: ['deep'], deep: [], unrelated: [] }),
    );

    expect([...transitiveClosure(graph, ['app'])].sort()).toEqual(['app', 'deep', 'mid']);
  });

  it('terminates on a dependency cycle', () => {
    const graph = buildDependencyGraph(env({ a: ['b'], b: ['c'], c: ['a'] }));
    expect([...transitiveClosure(graph, ['a'])].sort()).toEqual(['a', 'b', 'c']);
  });

  it('excludes extras unless asked', () => {
    const graph = buildDependencyGraph(
      env({ app: ["plugin; extra == 'all'"], plugin: [] }),
    );

    expect([...transitiveClosure(graph, ['app'])]).toEqual(['app']);
    expect([...transitiveClosure(graph, ['app'], { includeOptional: true })].sort()).toEqual([
      'app',
      'plugin',
    ]);
  });

  it('ignores roots that are not installed', () => {
    const graph = buildDependencyGraph(env({ app: [] }));
    expect([...transitiveClosure(graph, ['ghost'])]).toEqual([]);
  });
});

describe('newlyOrphaned', () => {
  it('lists packages left with no remaining dependent', () => {
    const graph = buildDependencyGraph(
      env({ app: ['shared'], other: ['shared'], shared: [] }),
    );

    expect(newlyOrphaned(graph, new Set(['app']))).toEqual([]);
    expect(newlyOrphaned(graph, new Set(['app', 'other']))).toEqual(['shared']);
  });
});

describe('missing dependency reporting', () => {
  it('does not report an absent marker-gated requirement as missing', () => {
    const graph = buildDependencyGraph(
      env({ aiohttp: ['async-timeout>=4; python_version < "3.11"'] }),
    );
    expect(graph.missing.size).toBe(0);
  });

  it('still reports an absent unconditional requirement', () => {
    const graph = buildDependencyGraph(env({ app: ['truly-gone>=1'] }));
    expect(graph.missing.get('truly-gone')).toEqual(['app']);
  });
});
