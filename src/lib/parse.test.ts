import { describe, expect, it } from 'vitest';
import { ParseError, parseEnvironmentData } from './parse';

describe('parseEnvironmentData', () => {
  it('reads a collector report with environment details', () => {
    const report = JSON.stringify({
      schema: 'pysan/collector/v2',
      collected_at: '2026-01-01T00:00:00+00:00',
      python: { version: '3.12.1', platform: 'macOS-15', prefix: '/opt/venv' },
      packages: [
        { name: 'Requests', version: '2.31.0', size: 1000, files: 12, requires: ['idna>=2.5'] },
        { name: 'idna', version: '3.6', size: 500, files: 5, requires: [] },
      ],
    });

    const parsed = parseEnvironmentData(report);

    expect(parsed.format).toBe('pysan-collector');
    expect(parsed.packages).toHaveLength(2);
    expect(parsed.environment.pythonVersion).toBe('3.12.1');
    expect(parsed.environment.prefix).toBe('/opt/venv');
    expect(parsed.environment.hasDependencyMetadata).toBe(true);
    expect(parsed.environment.hasSizeMetadata).toBe(true);
    expect(parsed.packages.find((pkg) => pkg.id === 'requests')?.name).toBe('Requests');
  });

  it('reads a legacy array that carries sizes', () => {
    const parsed = parseEnvironmentData(
      JSON.stringify([{ name: 'numpy', version: '1.26.4', size: 42 }]),
    );

    expect(parsed.format).toBe('pysan-legacy');
    expect(parsed.environment.hasSizeMetadata).toBe(true);
    expect(parsed.environment.hasDependencyMetadata).toBe(false);
    expect(parsed.warnings.some((w) => w.includes('no dependency metadata'))).toBe(true);
  });

  it('reads pip list JSON', () => {
    const parsed = parseEnvironmentData(
      JSON.stringify([
        { name: 'pip', version: '24.0' },
        { name: 'wheel', version: '0.43.0' },
      ]),
    );

    expect(parsed.format).toBe('pip-list-json');
    expect(parsed.environment.hasSizeMetadata).toBe(false);
    expect(parsed.packages.every((pkg) => pkg.size === null)).toBe(true);
  });

  it('reads pip freeze text', () => {
    const parsed = parseEnvironmentData('numpy==1.26.4\npandas==2.2.1\n');

    expect(parsed.format).toBe('requirements-text');
    expect(parsed.packages.map((pkg) => pkg.id)).toEqual(['numpy', 'pandas']);
  });

  it('merges duplicate distributions and keeps the richer record', () => {
    const parsed = parseEnvironmentData(
      JSON.stringify([
        { name: 'numpy', version: '1.0', size: 0, requires: [] },
        { name: 'NumPy', version: '1.26.4', size: 9000, requires: ['foo'] },
      ]),
    );

    expect(parsed.packages).toHaveLength(1);
    expect(parsed.packages[0].size).toBe(9000);
    expect(parsed.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });

  it('sorts packages by normalized name', () => {
    const parsed = parseEnvironmentData('zlib-wrapper==1\nalpha==1\nmiddle==1\n');
    expect(parsed.packages.map((pkg) => pkg.id)).toEqual(['alpha', 'middle', 'zlib-wrapper']);
  });

  it('detects editable installs', () => {
    const parsed = parseEnvironmentData(
      JSON.stringify({
        packages: [{ name: 'mylib', version: '0.1.0', size: 1, editable: true }],
      }),
    );
    expect(parsed.packages[0].editable).toBe(true);
  });

  it.each([
    ['', 'No data supplied'],
    ['   \n  ', 'No data supplied'],
    ['{ not json', 'could not be parsed'],
    ['[]', 'empty'],
    ['[1, 2, 3]', 'no package objects'],
    ['{"schema":"x"}', 'missing a "packages" array'],
    ['this is prose, not a package list', 'Unrecognized format'],
  ])('rejects %j with a message about %s', (input, fragment) => {
    expect(() => parseEnvironmentData(input)).toThrow(ParseError);
    expect(() => parseEnvironmentData(input)).toThrow(new RegExp(fragment, 'i'));
  });

  it('rejects an array whose entries have no name', () => {
    expect(() => parseEnvironmentData('[{"version":"1.0"}]')).toThrow(/has a "name" field/);
  });
});
