/**
 * Dependency graph over the installed distributions.
 *
 * The graph answers the question that makes a removal recommendation safe:
 * if this package goes, what else breaks?
 */

import type { Package } from '../types';

export interface DependencyGraph {
  /** Every package, keyed by normalized name. */
  packages: ReadonlyMap<string, Package>;
  /** Hard (non-extra) requirements of each package that are installed. */
  requires: ReadonlyMap<string, readonly string[]>;
  /** Extra-gated requirements of each package that are installed. */
  optionalRequires: ReadonlyMap<string, readonly string[]>;
  /** Reverse edges of `requires`: who depends on this package. */
  requiredBy: ReadonlyMap<string, readonly string[]>;
  /** Requirements referenced by installed packages but not installed themselves. */
  missing: ReadonlyMap<string, readonly string[]>;
}

export function buildDependencyGraph(packages: readonly Package[]): DependencyGraph {
  const byId = new Map<string, Package>(packages.map((pkg) => [pkg.id, pkg]));
  const requires = new Map<string, string[]>();
  const optionalRequires = new Map<string, string[]>();
  const requiredBy = new Map<string, string[]>();
  const missing = new Map<string, string[]>();

  for (const pkg of packages) {
    const hard: string[] = [];
    const optional: string[] = [];

    for (const requirement of pkg.requires) {
      // A distribution requiring itself is a metadata quirk, not an edge.
      if (requirement.name === pkg.id) continue;

      if (!byId.has(requirement.name)) {
        // Only an unconditional requirement is genuinely missing. An extra
        // was never requested, and a marker-gated requirement is absent
        // because the marker does not hold on this interpreter.
        if (!requirement.optional && !requirement.conditional) {
          const list = missing.get(requirement.name) ?? [];
          list.push(pkg.id);
          missing.set(requirement.name, list);
        }
        continue;
      }

      if (requirement.optional) {
        if (!optional.includes(requirement.name)) optional.push(requirement.name);
        continue;
      }

      if (hard.includes(requirement.name)) continue;
      hard.push(requirement.name);

      const parents = requiredBy.get(requirement.name) ?? [];
      parents.push(pkg.id);
      requiredBy.set(requirement.name, parents);
    }

    requires.set(pkg.id, hard);
    optionalRequires.set(pkg.id, optional);
  }

  for (const parents of requiredBy.values()) parents.sort();
  for (const parents of missing.values()) parents.sort();

  return { packages: byId, requires, optionalRequires, requiredBy, missing };
}

/**
 * Every package reachable from `roots` by following requirement edges,
 * including the roots themselves. Cycles in the metadata are tolerated.
 */
export function transitiveClosure(
  graph: DependencyGraph,
  roots: Iterable<string>,
  options: { includeOptional?: boolean } = {},
): Set<string> {
  const { includeOptional = false } = options;
  const reached = new Set<string>();
  const queue: string[] = [];

  for (const root of roots) {
    if (graph.packages.has(root) && !reached.has(root)) {
      reached.add(root);
      queue.push(root);
    }
  }

  while (queue.length > 0) {
    const current = queue.pop() as string;
    const edges = includeOptional
      ? [...(graph.requires.get(current) ?? []), ...(graph.optionalRequires.get(current) ?? [])]
      : graph.requires.get(current) ?? [];

    for (const next of edges) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }

  return reached;
}

/**
 * Packages that would be left with no remaining dependent if `removing` were
 * uninstalled and that are not in `removing` themselves. Useful for telling
 * the user what else becomes safe to drop.
 */
export function newlyOrphaned(
  graph: DependencyGraph,
  removing: ReadonlySet<string>,
): string[] {
  const orphans: string[] = [];
  for (const [id, parents] of graph.requiredBy) {
    if (removing.has(id)) continue;
    if (parents.length === 0) continue;
    if (parents.every((parent) => removing.has(parent))) orphans.push(id);
  }
  return orphans.sort();
}
