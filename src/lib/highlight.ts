/**
 * A small Python tokenizer for display purposes.
 *
 * The original version of this app kept a second, hand-written HTML copy of
 * the script with the highlighting markup baked in, and injected it with
 * `dangerouslySetInnerHTML`. The two copies drifted. Tokenizing the real
 * source instead means there is one source of truth and no raw HTML injection.
 */

export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'keyword'
  | 'builtin'
  | 'number'
  | 'function'
  | 'decorator';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 'def',
  'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global', 'if',
  'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield', 'match', 'case',
]);

const BUILTINS = new Set([
  'None', 'True', 'False', 'self', 'cls', 'print', 'len', 'str', 'int', 'float',
  'bool', 'list', 'dict', 'set', 'tuple', 'open', 'range', 'enumerate', 'sorted',
  'sum', 'min', 'max', 'abs', 'any', 'all', 'zip', 'map', 'filter', 'isinstance',
  'getattr', 'setattr', 'hasattr', 'type', 'super', 'Exception', 'OSError',
  'ImportError', 'ValueError', 'TypeError', 'KeyError', 'SystemExit', 'bytes',
]);

const PATTERN = new RegExp(
  [
    '(#[^\\n]*)', // 1 comment
    '([rbfu]{0,2}"""[\\s\\S]*?"""|[rbfu]{0,2}\'\'\'[\\s\\S]*?\'\'\')', // 2 triple string
    '([rbfu]{0,2}"(?:\\\\.|[^"\\\\\\n])*"|[rbfu]{0,2}\'(?:\\\\.|[^\'\\\\\\n])*\')', // 3 string
    '(@[A-Za-z_][\\w.]*)', // 4 decorator
    '(\\b(?:def|class)\\s+)([A-Za-z_]\\w*)', // 5 keyword + 6 name
    '(\\b\\d[\\w.]*\\b)', // 7 number
    '([A-Za-z_]\\w*)', // 8 word
  ].join('|'),
  'g',
);

/** Split Python source into display tokens. Never throws. */
export function tokenizePython(source: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;

  const push = (kind: TokenKind, text: string) => {
    if (text === '') return;
    const previous = tokens[tokens.length - 1];
    if (previous && previous.kind === kind) previous.text += text;
    else tokens.push({ kind, text });
  };

  PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PATTERN.exec(source)) !== null) {
    if (match.index > lastIndex) push('plain', source.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;

    if (match[1]) push('comment', match[1]);
    else if (match[2]) push('string', match[2]);
    else if (match[3]) push('string', match[3]);
    else if (match[4]) push('decorator', match[4]);
    else if (match[5]) {
      push('keyword', match[5]);
      push('function', match[6]);
    } else if (match[7]) push('number', match[7]);
    else if (match[8]) {
      const word = match[8];
      if (KEYWORDS.has(word)) push('keyword', word);
      else if (BUILTINS.has(word)) push('builtin', word);
      else push('plain', word);
    }
  }

  if (lastIndex < source.length) push('plain', source.slice(lastIndex));
  return tokens;
}

export const TOKEN_CLASS: Record<TokenKind, string | undefined> = {
  plain: undefined,
  comment: 'tok-com',
  string: 'tok-str',
  keyword: 'tok-kw',
  builtin: 'tok-bi',
  number: 'tok-num',
  function: 'tok-fn',
  decorator: 'tok-dec',
};
