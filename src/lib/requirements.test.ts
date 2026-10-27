import { describe, expect, it } from 'vitest';
import { parseRequirement, parseRequirements, parseRequirementsFile } from './requirements';

describe('parseRequirement', () => {
  it('reads a bare name', () => {
    expect(parseRequirement('numpy')).toMatchObject({ name: 'numpy', optional: false });
  });

  it('strips version specifiers in every common style', () => {
    expect(parseRequirement('numpy (>=1.21)')?.name).toBe('numpy');
    expect(parseRequirement('numpy>=1.21,<2')?.name).toBe('numpy');
    expect(parseRequirement('numpy ~= 1.21')?.name).toBe('numpy');
    expect(parseRequirement('numpy!=1.0')?.name).toBe('numpy');
  });

  it('strips extras requested on the dependency', () => {
    expect(parseRequirement('celery[redis]>=5')?.name).toBe('celery');
  });

  it('normalizes the name it extracts', () => {
    expect(parseRequirement('typing_extensions>=4.4')?.name).toBe('typing-extensions');
    expect(parseRequirement('zope.interface>=5')?.name).toBe('zope-interface');
  });

  it('keeps an environment marker from making a requirement optional', () => {
    const parsed = parseRequirement('importlib-metadata>=4.6; python_version < "3.10"');
    expect(parsed).toMatchObject({ name: 'importlib-metadata', optional: false });
  });

  it('marks extra-gated requirements as optional', () => {
    expect(parseRequirement("pytest>=7 ; extra == 'test'")).toMatchObject({
      name: 'pytest',
      optional: true,
      extra: 'test',
    });
    expect(
      parseRequirement('brotli>=1.2; platform_python_implementation == "CPython" and extra == "speedups"'),
    ).toMatchObject({ name: 'brotli', optional: true, extra: 'speedups' });
  });

  it('returns null for blank and comment lines', () => {
    expect(parseRequirement('')).toBeNull();
    expect(parseRequirement('   ')).toBeNull();
    expect(parseRequirement('# a comment')).toBeNull();
  });

  it('handles direct references', () => {
    expect(parseRequirement('mypkg @ https://example.com/mypkg.whl')?.name).toBe('mypkg');
  });
});

describe('parseRequirements', () => {
  it('drops duplicates while keeping distinct extras', () => {
    const parsed = parseRequirements([
      'numpy>=1',
      'numpy>=2',
      "numpy>=3; extra == 'fast'",
      'bogus(',
    ]);
    expect(parsed.map((entry) => `${entry.name}:${entry.extra ?? ''}`)).toEqual([
      'numpy:',
      'numpy:fast',
      'bogus:',
    ]);
  });

  it('returns an empty list when metadata is missing', () => {
    expect(parseRequirements(undefined)).toEqual([]);
  });
});

describe('parseRequirementsFile', () => {
  it('reads pip freeze output', () => {
    const text = ['numpy==1.26.4', 'pandas==2.2.1', 'Django==5.0'].join('\n');
    expect(parseRequirementsFile(text)).toEqual([
      { name: 'numpy', version: '1.26.4' },
      { name: 'pandas', version: '2.2.1' },
      { name: 'django', version: '5.0' },
    ]);
  });

  it('skips comments, flags, blank lines and URL installs', () => {
    const text = [
      '# requirements',
      '',
      '-r other.txt',
      '--index-url https://example.com',
      'https://example.com/pkg.whl',
      'requests==2.31.0  # pinned',
    ].join('\n');
    expect(parseRequirementsFile(text)).toEqual([{ name: 'requests', version: '2.31.0' }]);
  });

  it('keeps unpinned entries with an empty version', () => {
    expect(parseRequirementsFile('flask>=3.0')).toEqual([{ name: 'flask', version: '' }]);
  });
});

describe('conditional requirements', () => {
  it('marks a requirement gated by an environment marker as conditional', () => {
    expect(parseRequirement('async-timeout>=4; python_version < "3.11"')).toMatchObject({
      name: 'async-timeout',
      optional: false,
      conditional: true,
    });
    expect(parseRequirement('colorama; platform_system == "Windows"')).toMatchObject({
      conditional: true,
    });
  });

  it('does not call an extra-only marker conditional', () => {
    expect(parseRequirement("pytest; extra == 'test'")).toMatchObject({
      optional: true,
      conditional: false,
    });
  });

  it('marks a requirement gated by both an extra and a platform as both', () => {
    expect(
      parseRequirement('brotli; platform_python_implementation == "CPython" and extra == "speedups"'),
    ).toMatchObject({ optional: true, conditional: true });
  });

  it('calls an unmarked requirement neither', () => {
    expect(parseRequirement('numpy>=1.21')).toMatchObject({
      optional: false,
      conditional: false,
    });
  });
});
