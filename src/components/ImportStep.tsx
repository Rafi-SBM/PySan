import { useCallback, useRef, useState, type DragEvent } from 'react';
import collectorSource from '../../scripts/pysan_collect.py?raw';
import { CodeBlock } from './CodeBlock';
import { Icon } from './Icon';
import { Notice } from './Notice';
import { FORMAT_LABELS } from '../lib/parse';
import { formatCount, formatSize, formatTimestamp } from '../lib/format';
import type { ParsedEnvironment } from '../types';

const MAX_FILE_BYTES = 64 * 1024 * 1024;
const COLLECTOR_FILENAME = 'pysan_collect.py';

interface ImportStepProps {
  value: string;
  onChange: (value: string) => void;
  parsed: ParsedEnvironment | null;
  parseError: string | null;
  onContinue: () => void;
  onClear: () => void;
}

export function ImportStep({
  value,
  onChange,
  parsed,
  parseError,
  onContinue,
  onClear,
}: ImportStepProps) {
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = useCallback(
    (file: File) => {
      setFileError(null);
      if (file.size > MAX_FILE_BYTES) {
        setFileError(
          `${file.name} is ${formatSize(file.size)}, which is larger than the ` +
            `${formatSize(MAX_FILE_BYTES)} limit.`,
        );
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onChange(String(reader.result ?? ''));
      reader.onerror = () => setFileError(`Could not read ${file.name}.`);
      reader.readAsText(file);
    },
    [onChange],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer.files?.[0];
      if (file) readFile(file);
    },
    [readFile],
  );

  return (
    <section aria-labelledby="import-heading">
      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title" id="import-heading">
              Collect your environment
            </h2>
            <p className="card__hint">
              Run the collector with the interpreter you want to inspect. It reads package
              metadata only: nothing is installed, removed or sent anywhere.
            </p>
          </div>
        </div>

        <ol className="steps-list">
          <li>
            <h4>Save the collector script</h4>
            <p>
              Download it, or copy it into a file named <code>{COLLECTOR_FILENAME}</code>.
              It uses the standard library only and supports Python 3.8 and newer.
            </p>
            <CodeBlock
              code={collectorSource}
              label={COLLECTOR_FILENAME}
              language="python"
              downloadAs={COLLECTOR_FILENAME}
            />
          </li>
          <li>
            <h4>Run it against your environment</h4>
            <p>
              Activate the virtual environment first, or substitute the full path to the
              interpreter you want to inspect.
            </p>
            <CodeBlock
              code={`python ${COLLECTOR_FILENAME} -o pysan-environment.json`}
              label="shell"
              compact
            />
          </li>
          <li>
            <h4>Bring the report back here</h4>
            <p>Upload the file it wrote, or paste the contents below.</p>
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Load the report</h2>
            <p className="card__hint">
              Accepts collector output, <code>pip list --format=json</code>, or
              <code> pip freeze</code> text. Only collector output carries the dependency
              metadata needed to verify that a removal is safe.
            </p>
          </div>
        </div>

        <div
          className="dropzone"
          data-active={dragging}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <Icon name="upload" size={22} className="dropzone__icon" />
          <strong>Drop your report here, or click to choose a file</strong>
          <small>JSON or text, up to {formatSize(MAX_FILE_BYTES)}</small>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".json,.txt,application/json,text/plain"
          className="visually-hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) readFile(file);
            event.target.value = '';
          }}
        />

        <label className="field" style={{ marginTop: 'var(--space-4)' }}>
          <span className="field__label">Or paste the report contents</span>
          <textarea
            className="textarea"
            spellCheck={false}
            placeholder={'{\n  "schema": "pysan/collector/v2",\n  "packages": [ ... ]\n}'}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>

        {fileError && <Notice tone="danger">{fileError}</Notice>}
        {parseError && (
          <Notice tone="danger" title="That data could not be read">
            {parseError}
          </Notice>
        )}

        {parsed && (
          <>
            <Notice tone="success" title={`${FORMAT_LABELS[parsed.format]} loaded`}>
              <p>
                {formatCount(parsed.packages.length, 'package')} found
                {parsed.environment.hasSizeMetadata
                  ? '. Sizes are available.'
                  : '. Sizes are not available in this format.'}
              </p>
            </Notice>

            {parsed.warnings.map((warning) => (
              <Notice tone="warning" key={warning}>
                {warning}
              </Notice>
            ))}

            {(parsed.environment.pythonVersion ?? parsed.environment.prefix) && (
              <details className="detail">
                <summary>
                  <Icon name="chevron-right" size={14} />
                  Environment details
                </summary>
                <div className="detail__body">
                  <dl className="kv">
                    {parsed.environment.pythonVersion && (
                      <>
                        <dt>Python</dt>
                        <dd>{parsed.environment.pythonVersion}</dd>
                      </>
                    )}
                    {parsed.environment.platform && (
                      <>
                        <dt>Platform</dt>
                        <dd>{parsed.environment.platform}</dd>
                      </>
                    )}
                    {parsed.environment.prefix && (
                      <>
                        <dt>Prefix</dt>
                        <dd>{parsed.environment.prefix}</dd>
                      </>
                    )}
                    {formatTimestamp(parsed.environment.collectedAt) && (
                      <>
                        <dt>Collected</dt>
                        <dd>{formatTimestamp(parsed.environment.collectedAt)}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </details>
            )}
          </>
        )}

        <div className="btn-row btn-row--between" style={{ marginTop: 'var(--space-5)' }}>
          <button type="button" className="btn btn--ghost" onClick={onClear} disabled={!value}>
            <Icon name="close" size={14} />
            Clear
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={onContinue}
            disabled={!parsed}
          >
            Choose profiles
            <Icon name="chevron-right" size={15} />
          </button>
        </div>
      </div>
    </section>
  );
}
