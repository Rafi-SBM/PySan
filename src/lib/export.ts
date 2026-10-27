/**
 * Report generation. Everything is produced in the browser; no request leaves
 * the page.
 */

import { formatSize } from './format';
import { profileLabel } from './profiles';
import type { AnalysisResult, Decision, EnvironmentInfo } from '../types';

function describeReason(decision: Decision): string {
  switch (decision.reason.kind) {
    case 'protected':
      return 'protected packaging tooling';
    case 'profile':
      return `matches ${decision.reason.profileKeys.map(profileLabel).join(', ')}`;
    case 'dependency':
      return decision.reason.requiredBy.length > 0
        ? `required by ${decision.reason.requiredBy.join(', ')}`
        : 'required by a kept package';
    case 'user-keep':
      return 'kept manually';
    case 'user-remove':
      return 'marked for removal manually';
    case 'unmatched':
      return 'no selected profile needs it';
  }
}

export const REASON_LABELS: Record<Decision['reason']['kind'], string> = {
  protected: 'Protected',
  profile: 'Profile match',
  dependency: 'Dependency',
  'user-keep': 'Kept manually',
  'user-remove': 'Removing manually',
  unmatched: 'Unmatched',
};

/** Names only, suitable for `pip uninstall -r`. */
export function toRemovalList(result: AnalysisResult): string {
  const header = [
    '# Packages PySan flagged for removal.',
    '# Review this list before running any uninstall command.',
    `# Generated ${new Date().toISOString()}`,
    '',
  ];
  return [...header, ...result.remove.map((decision) => decision.package.name), ''].join('\n');
}

/** Pinned requirements for everything that stays. */
export function toKeepRequirements(result: AnalysisResult): string {
  const header = [
    '# Packages PySan recommends keeping.',
    `# Generated ${new Date().toISOString()}`,
    '',
  ];
  const lines = result.keep.map((decision) =>
    decision.package.version
      ? `${decision.package.name}==${decision.package.version}`
      : decision.package.name,
  );
  return [...header, ...lines, ''].join('\n');
}

export function toJsonReport(
  result: AnalysisResult,
  environment: EnvironmentInfo,
  profiles: readonly string[],
): string {
  const describe = (decision: Decision) => ({
    name: decision.package.name,
    version: decision.package.version || null,
    size: decision.package.size,
    reason: decision.reason.kind,
    detail: describeReason(decision),
  });

  return `${JSON.stringify(
    {
      schema: 'pysan/report/v1',
      generated_at: new Date().toISOString(),
      environment: {
        python_version: environment.pythonVersion,
        platform: environment.platform,
        prefix: environment.prefix,
        collected_at: environment.collectedAt,
        dependency_metadata: environment.hasDependencyMetadata,
        size_metadata: environment.hasSizeMetadata,
      },
      profiles,
      stats: result.stats,
      keep: result.keep.map(describe),
      remove: result.remove.map(describe),
      missing_dependencies: result.missingDependencies,
      warnings: result.warnings,
    },
    null,
    2,
  )}\n`;
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsvReport(result: AnalysisResult): string {
  const rows: string[] = ['name,version,size_bytes,decision,reason,detail'];
  for (const decision of [...result.keep, ...result.remove]) {
    rows.push(
      [
        csvCell(decision.package.name),
        csvCell(decision.package.version || null),
        csvCell(decision.package.size),
        decision.keep ? 'keep' : 'remove',
        decision.reason.kind,
        csvCell(describeReason(decision)),
      ].join(','),
    );
  }
  return `${rows.join('\n')}\n`;
}

export function toMarkdownReport(
  result: AnalysisResult,
  environment: EnvironmentInfo,
  profiles: readonly string[],
): string {
  const { stats } = result;
  const lines: string[] = [
    '# PySan environment report',
    '',
    `Generated ${new Date().toISOString()}`,
    '',
    '## Environment',
    '',
    `- Python: ${environment.pythonVersion ?? 'not reported'}`,
    `- Platform: ${environment.platform ?? 'not reported'}`,
    `- Prefix: ${environment.prefix ?? 'not reported'}`,
    `- Dependency metadata: ${environment.hasDependencyMetadata ? 'available' : 'unavailable'}`,
    '',
    '## Summary',
    '',
    `- Packages analyzed: ${stats.totalPackages}`,
    `- Keeping: ${stats.keepCount} (${formatSize(stats.keepSize)})`,
    `- Flagged for review: ${stats.removeCount} (${formatSize(stats.removeSize)})`,
    `- Kept as dependencies of other packages: ${stats.dependencyCount}`,
    '',
    `Profiles: ${profiles.length > 0 ? profiles.map(profileLabel).join(', ') : 'none selected'}`,
    '',
    '## Flagged for review',
    '',
    '| Package | Version | Size | Reason |',
    '| --- | --- | --- | --- |',
  ];

  for (const decision of result.remove) {
    lines.push(
      `| ${decision.package.name} | ${decision.package.version || '-'} | ` +
        `${formatSize(decision.package.size)} | ${describeReason(decision)} |`,
    );
  }

  lines.push('', '## Keeping', '', '| Package | Version | Size | Reason |', '| --- | --- | --- | --- |');
  for (const decision of result.keep) {
    lines.push(
      `| ${decision.package.name} | ${decision.package.version || '-'} | ` +
        `${formatSize(decision.package.size)} | ${describeReason(decision)} |`,
    );
  }

  if (result.missingDependencies.length > 0) {
    lines.push('', '## Missing dependencies', '');
    for (const entry of result.missingDependencies) {
      lines.push(`- \`${entry.name}\` required by ${entry.requiredBy.join(', ')}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

export { describeReason };

/** Trigger a client-side download of generated text. */
export function downloadText(filename: string, contents: string, mime = 'text/plain'): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
