import { describe, expect, it } from 'vitest';
import { tokenizePython } from './highlight';

const kinds = (source: string) =>
  tokenizePython(source).map((token) => `${token.kind}:${token.text}`);

describe('tokenizePython', () => {
  it('reproduces the input exactly when tokens are concatenated', () => {
    const source = [
      '# comment',
      'import os',
      'def f(x: int = 3) -> str:',
      '    """doc"""',
      "    return f'{x}' # trailing",
      '@decorator',
      'class C(Base): pass',
    ].join('\n');

    expect(tokenizePython(source).map((token) => token.text).join('')).toBe(source);
  });

  it('classifies comments, strings, keywords, numbers and names', () => {
    expect(kinds('# note')).toEqual(['comment:# note']);
    expect(kinds('"text"')).toEqual(['string:"text"']);
    expect(kinds("'text'")).toEqual(["string:'text'"]);
    expect(kinds('42')).toEqual(['number:42']);
    expect(kinds('def go')).toEqual(['keyword:def ', 'function:go']);
    expect(kinds('None')).toEqual(['builtin:None']);
    expect(kinds('@wraps')).toEqual(['decorator:@wraps']);
  });

  it('keeps a hash inside a string out of comment territory', () => {
    expect(kinds('"# not a comment"')).toEqual(['string:"# not a comment"']);
  });

  it('handles triple-quoted strings spanning lines', () => {
    const tokens = tokenizePython('"""line one\nline two"""');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('string');
  });

  it('handles prefixed strings', () => {
    expect(tokenizePython('f"{x}"')[0].kind).toBe('string');
    expect(tokenizePython('rb"raw"')[0].kind).toBe('string');
  });

  it('does not classify a keyword embedded in an identifier', () => {
    expect(kinds('define')).toEqual(['plain:define']);
    expect(kinds('nonetype')).toEqual(['plain:nonetype']);
  });

  it('returns nothing for empty input and never throws on odd input', () => {
    expect(tokenizePython('')).toEqual([]);
    expect(() => tokenizePython('"unterminated')).not.toThrow();
    expect(() => tokenizePython('\u0000\\\\')).not.toThrow();
  });
});
