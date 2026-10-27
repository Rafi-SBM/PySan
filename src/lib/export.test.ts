import { describe, expect, it } from 'vitest';
import { analyzeEnvironment } from './analyze';
import { parseEnvironmentData } from './parse';
import {
  toCsvReport,
  toJsonReport,
  toKeepRequirements,
  toMarkdownReport,
  toRemovalList,
} from './export';

const parsed = parseEnvironmentData(
  JSON.stringify({
    python: { version: '3.12.1', platform: 'linux' },
    packages: [
      {
        name: 'pandas',
        version: '2.2.1',
        size: 50_000_000,
        requires: ['numpy>=1.23', 'obscure-helper>=0.9'],
      },
      { name: 'numpy', version: '1.26.4', size: 30_000_000, requires: [] },
      // Matches no profile, so it is kept only because pandas requires it.
      { name: 'obscure-helper', version: '0.9.1', size: 400_000, requires: [] },
      { name: 'pygame', version: '2.5.2', size: 12_000_000, requires: [] },
    ],
  }),
);

const result = analyzeEnvironment(parsed.packages, { profiles: ['data_science'] });

describe('toRemovalList', () => {
  it('lists only flagged packages, one per line, with a comment header', () => {
    const text = toRemovalList(result);
    const lines = text.split('\n').filter((line) => line && !line.startsWith('#'));

    expect(lines).toEqual(['pygame']);
    expect(text.startsWith('#')).toBe(true);
  });
});

describe('toKeepRequirements', () => {
  it('pins kept packages in requirements format', () => {
    const lines = toKeepRequirements(result)
      .split('\n')
      .filter((line) => line && !line.startsWith('#'));

    expect(lines.sort()).toEqual([
      'numpy==1.26.4',
      'obscure-helper==0.9.1',
      'pandas==2.2.1',
    ]);
  });

  it('omits the pin when no version is known', () => {
    const noVersion = analyzeEnvironment(
      parseEnvironmentData('solo\n').packages,
      { profiles: [] },
    );
    expect(toKeepRequirements(noVersion)).not.toContain('==');
  });
});

describe('toJsonReport', () => {
  it('produces a parseable report with stats, reasons and environment', () => {
    const report = JSON.parse(toJsonReport(result, parsed.environment, ['data_science']));

    expect(report.schema).toBe('pysan/report/v1');
    expect(report.environment.python_version).toBe('3.12.1');
    expect(report.profiles).toEqual(['data_science']);
    expect(report.stats.totalPackages).toBe(4);
    expect(report.remove).toEqual([
      expect.objectContaining({ name: 'pygame', reason: 'unmatched' }),
    ]);
    expect(report.keep).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'obscure-helper',
          reason: 'dependency',
          detail: 'required by pandas',
        }),
      ]),
    );
  });
});

describe('toCsvReport', () => {
  it('writes a header and one row per package', () => {
    const rows = toCsvReport(result).trim().split('\n');

    expect(rows[0]).toBe('name,version,size_bytes,decision,reason,detail');
    expect(rows).toHaveLength(5);
    expect(rows.some((row) => row.startsWith('pygame,2.5.2,12000000,remove,unmatched'))).toBe(
      true,
    );
  });

  it('quotes values containing a comma', () => {
    const multi = analyzeEnvironment(parsed.packages, {
      profiles: ['data_science', 'scientific'],
    });
    expect(toCsvReport(multi)).toContain('"');
  });
});

describe('toMarkdownReport', () => {
  it('includes both tables and the summary figures', () => {
    const markdown = toMarkdownReport(result, parsed.environment, ['data_science']);

    expect(markdown).toContain('# PySan environment report');
    expect(markdown).toContain('## Flagged for review');
    expect(markdown).toContain('## Keeping');
    expect(markdown).toContain('Packages analyzed: 4');
    expect(markdown).toContain('| pygame |');
  });

  it('reports missing dependencies when there are any', () => {
    const broken = analyzeEnvironment(
      parseEnvironmentData(
        JSON.stringify({ packages: [{ name: 'pandas', size: 1, requires: ['gone>=1'] }] }),
      ).packages,
      { profiles: ['data_science'] },
    );

    expect(toMarkdownReport(broken, parsed.environment, [])).toContain('## Missing dependencies');
  });
});
