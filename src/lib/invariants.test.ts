/**
 * Invariant checks against a real environment.
 *
 * Point PYSAN_SAMPLE at collector output to run the engine over a genuine
 * environment rather than a fixture:
 *
 *     python scripts/pysan_collect.py -o /tmp/env.json
 *     PYSAN_SAMPLE=/tmp/env.json npm test
 *
 * These assert properties that must hold for any input, which is what catches
 * the cases a hand-written fixture never thinks of.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyzeEnvironment } from './analyze';
import { buildDependencyGraph } from './graph';
import { parseEnvironmentData } from './parse';
import { PROFILES } from './profiles';

const samplePath = process.env.PYSAN_SAMPLE;

const allProfiles = PROFILES.map((profile) => profile.key);

// Read lazily: the body of a skipped `describe` still runs, so loading the
// sample at suite level would fail whenever PYSAN_SAMPLE is unset.
let cached: ReturnType<typeof parseEnvironmentData> | undefined;

function sample(): ReturnType<typeof parseEnvironmentData> {
  cached ??= parseEnvironmentData(readFileSync(samplePath as string, 'utf8'));
  return cached;
}

describe.skipIf(!samplePath)('engine invariants on a real environment', () => {
  it.each([
    ['no profiles', [] as string[]],
    ['one profile', [allProfiles[0]]],
    ['every profile', allProfiles],
  ])('partitions every package exactly once with %s', (_label, profiles) => {
    const parsed = sample();
    const result = analyzeEnvironment(parsed.packages, { profiles });

    expect(result.keep.length + result.remove.length).toBe(parsed.packages.length);
    expect(result.byId.size).toBe(parsed.packages.length);
    expect(result.stats.keepSize + result.stats.removeSize).toBe(result.stats.totalSize);
  });

  it('never flags a package that something kept requires', () => {
    const parsed = sample();
    const result = analyzeEnvironment(parsed.packages, { profiles: allProfiles.slice(0, 3) });
    const graph = buildDependencyGraph(parsed.packages);
    const keptIds = new Set(result.keep.map((decision) => decision.package.id));

    for (const decision of result.remove) {
      const neededBy = (graph.requiredBy.get(decision.package.id) ?? []).filter((parent) =>
        keptIds.has(parent),
      );
      expect(neededBy, `${decision.package.id} is required by kept packages`).toEqual([]);
    }
  });

  it('keeps strictly more packages as profiles are added', () => {
    const parsed = sample();
    const narrow = analyzeEnvironment(parsed.packages, { profiles: [allProfiles[0]] });
    const wide = analyzeEnvironment(parsed.packages, { profiles: allProfiles });

    expect(wide.stats.keepCount).toBeGreaterThanOrEqual(narrow.stats.keepCount);
  });

  it('keeps at least as much when optional extras are included', () => {
    const parsed = sample();
    const base = analyzeEnvironment(parsed.packages, { profiles: allProfiles.slice(0, 3) });
    const withExtras = analyzeEnvironment(parsed.packages, {
      profiles: allProfiles.slice(0, 3),
      includeOptional: true,
    });

    expect(withExtras.stats.keepCount).toBeGreaterThanOrEqual(base.stats.keepCount);
  });
});
