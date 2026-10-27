/**
 * Parsing of PEP 508 dependency specifiers as found in the `Requires-Dist`
 * metadata field, e.g.
 *
 *   numpy (>=1.21)
 *   importlib-metadata>=4.6; python_version < "3.10"
 *   pytest>=7 ; extra == 'test'
 *   zope.interface[docs]>=5
 */

import { normalizeName } from './normalize';

export interface Requirement {
  /** PEP 503 normalized name of the required distribution. */
  name: string;
  /** Raw specifier as it appeared in the metadata. */
  raw: string;
  /** True when the requirement is gated behind an extra, e.g. `extra == "dev"`. */
  optional: boolean;
  /**
   * True when an environment marker other than `extra` gates the requirement,
   * such as `python_version < "3.11"` or `platform_system == "Windows"`.
   * Markers cannot be evaluated outside the target interpreter, so a
   * conditional requirement being absent is expected rather than broken.
   */
  conditional: boolean;
  /** The extra that gates this requirement, when there is one. */
  extra?: string;
}

const NAME_TERMINATORS = new Set(['[', '(', '<', '>', '=', '!', '~', ';', ' ', '\t', ',', '@']);
const EXTRA_MARKER = /\bextra\s*==\s*['"]([^'"]*)['"]/;
const EXTRA_CLAUSE = /\bextra\s*(?:==|!=)\s*['"][^'"]*['"]/g;

/** True when a marker constrains anything beyond which extras were requested. */
function hasNonExtraCondition(marker: string): boolean {
  return (
    marker
      .replace(EXTRA_CLAUSE, '')
      .replace(/\b(?:and|or|not)\b/g, '')
      .replace(/[()\s]/g, '') !== ''
  );
}

/** Parse a single dependency specifier. Returns null when no name is present. */
export function parseRequirement(raw: string): Requirement | null {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed.startsWith('#')) return null;

  const semicolon = trimmed.indexOf(';');
  const head = semicolon === -1 ? trimmed : trimmed.slice(0, semicolon);
  const marker = semicolon === -1 ? '' : trimmed.slice(semicolon + 1);

  let end = 0;
  while (end < head.length && !NAME_TERMINATORS.has(head[end])) end += 1;

  const name = head.slice(0, end).trim();
  if (name === '') return null;

  const extraMatch = EXTRA_MARKER.exec(marker);

  return {
    name: normalizeName(name),
    raw: trimmed,
    optional: extraMatch !== null,
    conditional: hasNonExtraCondition(marker),
    ...(extraMatch ? { extra: extraMatch[1] } : {}),
  };
}

/** Parse every specifier in a `Requires-Dist` list, discarding unparseable entries. */
export function parseRequirements(raw: readonly string[] | undefined): Requirement[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: Requirement[] = [];
  for (const entry of raw) {
    const requirement = parseRequirement(entry);
    if (!requirement) continue;
    const key = `${requirement.name}\u0000${requirement.extra ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(requirement);
  }
  return out;
}

/**
 * A requirement line is a distribution name optionally followed by extras, a
 * version specifier, a direct reference or an environment marker. Anything
 * else is prose, and prose must not be read as a package list.
 */
const REQUIREMENT_LINE =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\s*(?:\[[^\]]*\])?\s*(?:[<>=!~@;].*)?$/;

/**
 * Extract `name==version` pairs from `pip freeze` or requirements.txt text.
 * Lines that pin nothing still yield a name so the environment can be read
 * from a bare requirements file.
 */
export function parseRequirementsFile(text: string): { name: string; version: string }[] {
  const out: { name: string; version: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const stripped = line.split(' #')[0].trim();
    if (stripped === '' || stripped.startsWith('#') || stripped.startsWith('-')) continue;
    // Skip direct URL and local path installs, which carry no usable name.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(stripped)) continue;

    if (!REQUIREMENT_LINE.test(stripped)) continue;

    const requirement = parseRequirement(stripped);
    if (!requirement) continue;

    const pin = /==\s*([^\s;,]+)/.exec(stripped);
    out.push({ name: requirement.name, version: pin ? pin[1] : '' });
  }
  return out;
}
