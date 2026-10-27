import type { Requirement } from '../lib/requirements';

/** A single installed distribution. */
export interface Package {
  /** Name as reported by the environment. */
  name: string;
  /** PEP 503 normalized name, used for every lookup and comparison. */
  id: string;
  /** Installed version, or an empty string when the source did not report one. */
  version: string;
  /** Total size on disk in bytes, or null when the source did not measure it. */
  size: number | null;
  /** Number of files owned by the distribution, when known. */
  files: number | null;
  /** Parsed `Requires-Dist` entries, empty when metadata was unavailable. */
  requires: Requirement[];
  /** Whether the distribution is installed in editable or development mode. */
  editable: boolean;
  /** Install location, when reported. */
  location: string | null;
}

/** Details of the environment the packages were collected from. */
export interface EnvironmentInfo {
  pythonVersion: string | null;
  platform: string | null;
  prefix: string | null;
  collectedAt: string | null;
  /** True when the input carried `Requires-Dist` metadata for at least one package. */
  hasDependencyMetadata: boolean;
  /** True when the input carried size measurements. */
  hasSizeMetadata: boolean;
}

export type InputFormat =
  | 'pysan-collector'
  | 'pysan-legacy'
  | 'pip-list-json'
  | 'requirements-text';

export interface ParsedEnvironment {
  packages: Package[];
  environment: EnvironmentInfo;
  format: InputFormat;
  /** Non-fatal observations worth showing to the user. */
  warnings: string[];
}

/** Why a package ended up on the keep or the remove side. */
export type DecisionReason =
  | { kind: 'protected' }
  | { kind: 'profile'; profileKeys: string[] }
  | { kind: 'dependency'; requiredBy: string[] }
  | { kind: 'user-keep' }
  | { kind: 'user-remove' }
  | { kind: 'unmatched' };

export interface Decision {
  package: Package;
  keep: boolean;
  reason: DecisionReason;
}

export interface AnalysisStats {
  totalPackages: number;
  keepCount: number;
  removeCount: number;
  keepSize: number;
  removeSize: number;
  totalSize: number;
  /** Packages whose size could not be measured. */
  unsizedCount: number;
  /** Removal candidates kept only because something else needs them. */
  dependencyCount: number;
}

export interface AnalysisResult {
  keep: Decision[];
  remove: Decision[];
  byId: ReadonlyMap<string, Decision>;
  stats: AnalysisStats;
  /** Requirements referenced by installed packages but absent from the environment. */
  missingDependencies: { name: string; requiredBy: string[] }[];
  warnings: string[];
}

export type OverrideMode = 'keep' | 'remove';
export type Overrides = Readonly<Record<string, OverrideMode>>;
