/**
 * Classification of an environment into packages to keep and packages to review.
 *
 * The rules, applied in order:
 *
 *  1. Protected packaging tooling is always kept.
 *  2. A package the user pinned is kept; a package the user forced is removed.
 *  3. A package matching a selected profile is kept.
 *  4. A package reachable from any kept package by requirement edges is kept,
 *     because uninstalling it would break something that stays.
 *  5. Everything else is a removal candidate.
 *
 * Rule 4 is what separates a recommendation from a trap. Without dependency
 * metadata it cannot run, and the caller is told so.
 */

import { buildDependencyGraph, transitiveClosure, type DependencyGraph } from './graph';
import { findMatch, matchesPattern } from './normalize';
import { PROFILES_BY_KEY, PROTECTED_PACKAGES } from './profiles';
import type {
  AnalysisResult,
  AnalysisStats,
  Decision,
  Overrides,
  Package,
} from '../types';

export interface AnalyzeOptions {
  /** Profile keys the user selected. */
  profiles: readonly string[];
  /** Per-package keep or remove overrides, keyed by normalized name. */
  overrides?: Overrides;
  /** Treat extra-gated requirements as hard requirements. */
  includeOptional?: boolean;
}

function isProtected(id: string): boolean {
  return findMatch(id, PROTECTED_PACKAGES) !== undefined;
}

function matchingProfiles(id: string, profiles: readonly string[]): string[] {
  const matched: string[] = [];
  for (const key of profiles) {
    const profile = PROFILES_BY_KEY.get(key);
    if (!profile) continue;
    if (profile.packages.some((pattern) => matchesPattern(id, pattern))) matched.push(key);
  }
  return matched;
}

function sumSizes(decisions: readonly Decision[]): number {
  return decisions.reduce((total, decision) => total + (decision.package.size ?? 0), 0);
}

function bySizeThenName(a: Decision, b: Decision): number {
  const sizeDelta = (b.package.size ?? 0) - (a.package.size ?? 0);
  return sizeDelta !== 0 ? sizeDelta : a.package.id.localeCompare(b.package.id);
}

export function analyzeEnvironment(
  packages: readonly Package[],
  options: AnalyzeOptions,
): AnalysisResult {
  const { profiles, overrides = {}, includeOptional = false } = options;
  const graph: DependencyGraph = buildDependencyGraph(packages);
  const warnings: string[] = [];

  // Rules 1 to 3: the roots that anchor the keep set.
  const roots = new Set<string>();
  const rootReason = new Map<string, { profileKeys: string[] } | 'protected' | 'user-keep'>();
  const forcedRemoval = new Set<string>();

  for (const pkg of packages) {
    const override = overrides[pkg.id];

    if (isProtected(pkg.id)) {
      roots.add(pkg.id);
      rootReason.set(pkg.id, 'protected');
      continue;
    }

    if (override === 'remove') {
      forcedRemoval.add(pkg.id);
      continue;
    }

    if (override === 'keep') {
      roots.add(pkg.id);
      rootReason.set(pkg.id, 'user-keep');
      continue;
    }

    const matched = matchingProfiles(pkg.id, profiles);
    if (matched.length > 0) {
      roots.add(pkg.id);
      rootReason.set(pkg.id, { profileKeys: matched });
    }
  }

  // Rule 4: pull in everything the roots need.
  const kept = transitiveClosure(graph, roots, { includeOptional });

  // A forced removal that something kept still depends on is a real conflict.
  const conflicts: string[] = [];
  for (const id of forcedRemoval) {
    if (!kept.has(id)) continue;
    const parents = (graph.requiredBy.get(id) ?? []).filter(
      (parent) => kept.has(parent) && !forcedRemoval.has(parent),
    );
    if (parents.length > 0) conflicts.push(`${id} (needed by ${parents.join(', ')})`);
    kept.delete(id);
  }
  if (conflicts.length > 0) {
    warnings.push(
      `Marked for removal despite being a dependency: ${conflicts.join('; ')}. ` +
        'Uninstalling these will break the packages that need them.',
    );
  }

  const keep: Decision[] = [];
  const remove: Decision[] = [];
  const byId = new Map<string, Decision>();
  let dependencyCount = 0;
  let unsizedCount = 0;

  for (const pkg of packages) {
    if (pkg.size === null) unsizedCount += 1;

    let decision: Decision;

    if (kept.has(pkg.id)) {
      const reason = rootReason.get(pkg.id);
      if (reason === 'protected') {
        decision = { package: pkg, keep: true, reason: { kind: 'protected' } };
      } else if (reason === 'user-keep') {
        decision = { package: pkg, keep: true, reason: { kind: 'user-keep' } };
      } else if (reason) {
        decision = {
          package: pkg,
          keep: true,
          reason: { kind: 'profile', profileKeys: reason.profileKeys },
        };
      } else {
        const requiredBy = (graph.requiredBy.get(pkg.id) ?? []).filter((parent) =>
          kept.has(parent),
        );
        dependencyCount += 1;
        decision = { package: pkg, keep: true, reason: { kind: 'dependency', requiredBy } };
      }
      keep.push(decision);
    } else {
      decision = {
        package: pkg,
        keep: false,
        reason: forcedRemoval.has(pkg.id) ? { kind: 'user-remove' } : { kind: 'unmatched' },
      };
      remove.push(decision);
    }

    byId.set(pkg.id, decision);
  }

  keep.sort(bySizeThenName);
  remove.sort(bySizeThenName);

  const keepSize = sumSizes(keep);
  const removeSize = sumSizes(remove);

  const stats: AnalysisStats = {
    totalPackages: packages.length,
    keepCount: keep.length,
    removeCount: remove.length,
    keepSize,
    removeSize,
    totalSize: keepSize + removeSize,
    unsizedCount,
    dependencyCount,
  };

  const missingDependencies = [...graph.missing.entries()]
    .map(([name, requiredBy]) => ({ name, requiredBy: [...requiredBy] }))
    .sort((a, b) => b.requiredBy.length - a.requiredBy.length || a.name.localeCompare(b.name));

  return { keep, remove, byId, stats, missingDependencies, warnings };
}

export { buildDependencyGraph, transitiveClosure };
