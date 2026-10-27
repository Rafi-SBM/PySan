import { Fragment, useCallback, useState } from 'react';
import { Icon } from './Icon';
import { TOKEN_CLASS, tokenizePython } from '../lib/highlight';
import { downloadText } from '../lib/export';

interface CodeBlockProps {
  code: string;
  /** Filename or short description shown in the title bar. */
  label?: string;
  /** Highlight the contents as Python. Shell snippets stay unhighlighted. */
  language?: 'python' | 'shell' | 'text';
  /** Offer a download button writing the contents to this filename. */
  downloadAs?: string;
  compact?: boolean;
}

export function CodeBlock({
  code,
  label,
  language = 'text',
  downloadAs,
  compact = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be blocked; the text remains selectable.
    }
  }, [code]);

  const body =
    language === 'python' ? (
      tokenizePython(code).map((token, index) => {
        const className = TOKEN_CLASS[token.kind];
        return className ? (
          <span key={index} className={className}>
            {token.text}
          </span>
        ) : (
          <Fragment key={index}>{token.text}</Fragment>
        );
      })
    ) : (
      code
    );

  return (
    <div className={compact ? 'code code--compact' : 'code'}>
      <div className="code__bar">
        <span className="code__label">
          <Icon name={language === 'python' ? 'terminal' : 'terminal'} size={13} />
          {label ?? (language === 'python' ? 'python' : 'shell')}
        </span>
        <span className="code__actions">
          {downloadAs && (
            <button
              type="button"
              className="btn"
              onClick={() => downloadText(downloadAs, code)}
            >
              <Icon name="download" size={13} />
              Download
            </button>
          )}
          <button type="button" className="btn" onClick={handleCopy}>
            <Icon name={copied ? 'check' : 'copy'} size={13} />
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </div>
      <pre>
        <code>{body}</code>
      </pre>
    </div>
  );
}
