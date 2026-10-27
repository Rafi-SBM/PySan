/**
 * Input parsing.
 *
 * PySan accepts whatever the user can realistically get out of a Python
 * environment, in descending order of usefulness:
 *
 *  1. `pysan_collect.py` output  - sizes and dependency metadata
 *  2. legacy PySan JSON arrays   - sizes only
 *  3. `pip list --format=json`   - names and versions only
 *  4. `pip freeze` text          - names and versions only
 *
 * Formats without dependency metadata cannot be checked for safety, so the
 * parser records that fact on the result rather than hiding it.
 */

import { normalizeName } from './normalize';
import { parseRequirements, parseRequirementsFile } from './requirements';
import type { EnvironmentInfo, InputFormat, Package, ParsedEnvironment } from '../types';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

interface RawRecord {
  name?: unknown;
  version?: unknown;
  size?: unknown;
  files?: unknown;
  requires?: unknown;
  requires_dist?: unknown;
  editable?: unknown;
  location?: unknown;
  editable_project_location?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((entry): entry is string => typeof entry === 'string');
  return out.length === value.length ? out : out;
}

function toPackage(raw: RawRecord): Package | null {
  const name = asString(raw.name);
  if (!name) return null;

  const requiresRaw = asStringArray(raw.requires) ?? asStringArray(raw.requires_dist);

  return {
    name,
    id: normalizeName(name),
    version: asString(raw.version) ?? '',
    size: asNumber(raw.size),
    files: asNumber(raw.files),
    requires: parseRequirements(requiresRaw),
    editable: raw.editable === true || asString(raw.editable_project_location) !== null,
    location: asString(raw.location) ?? asString(raw.editable_project_location),
  };
}

/**
 * Collapse duplicate distributions, which appear when the same project is
 * installed into several entries on `sys.path`. The richest record wins.
 */
function dedupe(packages: Package[], warnings: string[]): Package[] {
  const byId = new Map<string, Package>();
  let duplicates = 0;

  for (const pkg of packages) {
    const existing = byId.get(pkg.id);
    if (!existing) {
      byId.set(pkg.id, pkg);
      continue;
    }
    duplicates += 1;
    const existingScore = (existing.size ?? 0) + existing.requires.length;
    const incomingScore = (pkg.size ?? 0) + pkg.requires.length;
    if (incomingScore > existingScore) byId.set(pkg.id, pkg);
  }

  if (duplicates > 0) {
    warnings.push(
      `Merged ${duplicates} duplicate ${duplicates === 1 ? 'distribution' : 'distributions'}. ` +
        'The same project appears more than once on this interpreter path.',
    );
  }

  return [...byId.values()];
}

function buildEnvironment(
  packages: Package[],
  source: Partial<EnvironmentInfo>,
): EnvironmentInfo {
  return {
    pythonVersion: source.pythonVersion ?? null,
    platform: source.platform ?? null,
    prefix: source.prefix ?? null,
    collectedAt: source.collectedAt ?? null,
    hasDependencyMetadata: packages.some((pkg) => pkg.requires.length > 0),
    hasSizeMetadata: packages.some((pkg) => pkg.size !== null && pkg.size > 0),
  };
}

function finalize(
  packages: Package[],
  format: InputFormat,
  source: Partial<EnvironmentInfo>,
  warnings: string[],
): ParsedEnvironment {
  const deduped = dedupe(packages, warnings);
  if (deduped.length === 0) {
    throw new ParseError('No packages found in the supplied data.');
  }

  const environment = buildEnvironment(deduped, source);

  if (!environment.hasDependencyMetadata) {
    warnings.push(
      'This data carries no dependency metadata, so removal candidates cannot be ' +
        'checked against what other packages need. Re-run the collector script for a ' +
        'safety-checked analysis.',
    );
  }
  if (!environment.hasSizeMetadata) {
    warnings.push('This data carries no package sizes, so reclaimable space is unknown.');
  }

  deduped.sort((a, b) => a.id.localeCompare(b.id));
  return { packages: deduped, environment, format, warnings };
}

function parseJsonInput(value: unknown, warnings: string[]): ParsedEnvironment {
  // Collector output: an object with a `packages` array and environment details.
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const envelope = value as Record<string, unknown>;
    if (!Array.isArray(envelope.packages)) {
      throw new ParseError(
        'JSON object is missing a "packages" array. Expected the output of pysan_collect.py.',
      );
    }
    const python = (envelope.python ?? {}) as Record<string, unknown>;
    const packages = (envelope.packages as RawRecord[])
      .map(toPackage)
      .filter((pkg): pkg is Package => pkg !== null);

    return finalize(packages, 'pysan-collector', {
      pythonVersion: asString(python.version),
      platform: asString(python.platform),
      prefix: asString(python.prefix),
      collectedAt: asString(envelope.collected_at),
    }, warnings);
  }

  if (!Array.isArray(value)) {
    throw new ParseError('Expected a JSON array of packages or a collector report object.');
  }
  if (value.length === 0) {
    throw new ParseError('The JSON array is empty, so there is nothing to analyze.');
  }

  const records = value.filter(
    (entry): entry is RawRecord => entry !== null && typeof entry === 'object',
  );
  if (records.length === 0) {
    throw new ParseError('The JSON array contains no package objects.');
  }

  const packages = records.map(toPackage).filter((pkg): pkg is Package => pkg !== null);
  if (packages.length === 0) {
    throw new ParseError('No entry in the JSON array has a "name" field.');
  }

  const hasSizes = records.some((record) => asNumber(record.size) !== null);
  return finalize(packages, hasSizes ? 'pysan-legacy' : 'pip-list-json', {}, warnings);
}

/** Parse pasted or uploaded environment data in any supported format. */
export function parseEnvironmentData(input: string): ParsedEnvironment {
  const text = input.trim();
  if (text === '') {
    throw new ParseError('No data supplied. Paste or upload your environment report first.');
  }

  const warnings: string[] = [];
  const looksLikeJson = text.startsWith('{') || text.startsWith('[');

  if (looksLikeJson) {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown error';
      throw new ParseError(`The data starts like JSON but could not be parsed: ${detail}`);
    }
    return parseJsonInput(value, warnings);
  }

  const entries = parseRequirementsFile(text);
  if (entries.length === 0) {
    throw new ParseError(
      'Unrecognized format. Supply collector JSON, "pip list --format=json" output, ' +
        'or "pip freeze" text.',
    );
  }

  const unpinned = entries.filter((entry) => entry.version === '').length;
  if (unpinned > 0) {
    warnings.push(
      `${unpinned} ${unpinned === 1 ? 'line has' : 'lines have'} no pinned version.`,
    );
  }

  const packages = entries.map<Package>((entry) => ({
    name: entry.name,
    id: normalizeName(entry.name),
    version: entry.version,
    size: null,
    files: null,
    requires: [],
    editable: false,
    location: null,
  }));

  return finalize(packages, 'requirements-text', {}, warnings);
}

export const FORMAT_LABELS: Record<InputFormat, string> = {
  'pysan-collector': 'Collector report',
  'pysan-legacy': 'Package list with sizes',
  'pip-list-json': 'pip list JSON',
  'requirements-text': 'Requirements text',
};
