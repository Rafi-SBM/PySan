/**
 * Distribution name handling as specified by PEP 503 / PEP 426.
 *
 * Two distribution names refer to the same project when their normalized
 * forms are equal: `zope.interface`, `zope-interface` and `Zope_Interface`
 * are all the project `zope-interface`.
 */

const SEPARATOR_RUN = /[-_.]+/g;

/** Normalize a distribution name to its PEP 503 canonical form. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(SEPARATOR_RUN, '-');
}

/**
 * Compile a profile pattern into a matcher.
 *
 * Patterns are normalized names that may end in `*` to match a whole
 * namespace, e.g. `azure-*` matches `azure-storage-blob` but not `azurerm`.
 * Matching is never implicitly prefix-based: `six` must not claim `sixpack`.
 */
export function matchesPattern(normalized: string, pattern: string): boolean {
  if (!pattern.endsWith('*')) return normalized === pattern;
  const prefix = pattern.slice(0, -1);
  if (prefix === '') return true;
  if (normalized === prefix.replace(/-$/, '')) return true;
  return normalized.startsWith(prefix);
}

/** Find the first pattern in `patterns` that matches `normalized`. */
export function findMatch(normalized: string, patterns: readonly string[]): string | undefined {
  return patterns.find((pattern) => matchesPattern(normalized, pattern));
}
