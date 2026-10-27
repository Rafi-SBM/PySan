import { useMemo, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { Icon } from './Icon';
import { Notice } from './Notice';
import {
  BACKUP_FILE_NAME,
  PACKAGE_MANAGERS,
  REMOVE_FILE_NAME,
  SHELLS,
  buildCommandPlan,
  type PackageManager,
  type Shell,
} from '../lib/commands';
import {
  downloadText,
  toCsvReport,
  toJsonReport,
  toKeepRequirements,
  toMarkdownReport,
  toRemovalList,
} from '../lib/export';
import { formatCount, formatSize } from '../lib/format';
import type { AnalysisResult, EnvironmentInfo } from '../types';

interface CleanupStepProps {
  result: AnalysisResult;
  environment: EnvironmentInfo;
  profiles: readonly string[];
  onBack: () => void;
  onStartOver: () => void;
}

export function CleanupStep({
  result,
  environment,
  profiles,
  onBack,
  onStartOver,
}: CleanupStepProps) {
  const [manager, setManager] = useState<PackageManager>('pip');
  const [shell, setShell] = useState<Shell>(() =>
    navigator.userAgent.includes('Windows') ? 'powershell' : 'posix',
  );

  const packages = useMemo(
    () => result.remove.map((decision) => decision.package),
    [result.remove],
  );
  const plan = useMemo(() => buildCommandPlan(packages, manager, shell), [
    packages,
    manager,
    shell,
  ]);

  const removalList = useMemo(() => toRemovalList(result), [result]);

  return (
    <section aria-labelledby="cleanup-heading">
      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title" id="cleanup-heading">
              Clean up {formatCount(result.stats.removeCount, 'package')}
            </h2>
            <p className="card__hint">
              Reclaims about {formatSize(result.stats.removeSize)}. Run these in a terminal
              with the same environment active that you collected from.
            </p>
          </div>
        </div>

        <Notice tone="warning" title="Read before running anything">
          <ul>
            <li>
              These commands uninstall packages. Nothing is reversible without the backup
              in step one, so do not skip it.
            </li>
            <li>
              Confirm the right environment is active. <code>which python</code> on macOS
              and Linux, <code>where python</code> on Windows.
            </li>
            <li>
              Removing from a system Python can break operating system tooling. Prefer a
              virtual environment.
            </li>
          </ul>
        </Notice>

        <div className="btn-row" style={{ marginBottom: 'var(--space-5)' }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="field__label">Package manager</span>
            <select
              className="select"
              value={manager}
              onChange={(event) => setManager(event.target.value as PackageManager)}
            >
              {PACKAGE_MANAGERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span className="field__label">Shell</span>
            <select
              className="select"
              value={shell}
              onChange={(event) => setShell(event.target.value as Shell)}
            >
              {SHELLS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ol className="steps-list">
          <li>
            <h4>Back up the current environment</h4>
            <p>
              Writes <code>{BACKUP_FILE_NAME}</code> so the environment can be rebuilt
              exactly as it is now.
            </p>
            <CodeBlock code={plan.backup} label="shell" compact />
          </li>

          <li>
            <h4>Save the removal list</h4>
            <p>
              Download <code>{REMOVE_FILE_NAME}</code> into the directory you will run the
              uninstall from. Open it first and delete any line you want to keep.
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={() => downloadText(REMOVE_FILE_NAME, removalList)}
              >
                <Icon name="download" size={14} />
                Download {REMOVE_FILE_NAME}
              </button>
            </div>
          </li>

          <li>
            <h4>Uninstall</h4>
            <p>
              The file form is the reliable one: it does not run into command line length
              limits, and the list stays reviewable on disk.
            </p>
            <CodeBlock code={plan.fromFile} label="shell" compact />

            <details className="detail">
              <summary>
                <Icon name="chevron-right" size={14} />
                Use a single command instead
                {plan.chunked && ` (split into ${plan.inline.length} parts)`}
              </summary>
              <div className="detail__body">
                {plan.chunked && (
                  <p>
                    The package list is too long for one command line, so it is split.
                    Run the parts in order.
                  </p>
                )}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <CodeBlock code={plan.inline.join('\n\n')} label="shell" compact />
                </div>
              </div>
            </details>
          </li>

          <li>
            <h4>Verify, and restore if needed</h4>
            <p>
              Import the packages you rely on, or run your test suite. If anything broke,
              this puts the environment back.
            </p>
            <CodeBlock code={plan.restore} label="shell" compact />
          </li>
        </ol>
      </div>

      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Export the analysis</h2>
            <p className="card__hint">
              Keep a record of what was decided and why. Generated in your browser.
            </p>
          </div>
        </div>

        <div className="btn-row">
          <button
            type="button"
            className="btn"
            onClick={() => downloadText('pysan-keep.txt', toKeepRequirements(result))}
          >
            <Icon name="download" size={14} />
            Keep list
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadText(
                'pysan-report.json',
                toJsonReport(result, environment, profiles),
                'application/json',
              )
            }
          >
            <Icon name="download" size={14} />
            JSON report
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => downloadText('pysan-report.csv', toCsvReport(result), 'text/csv')}
          >
            <Icon name="download" size={14} />
            CSV
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadText(
                'pysan-report.md',
                toMarkdownReport(result, environment, profiles),
                'text/markdown',
              )
            }
          >
            <Icon name="download" size={14} />
            Markdown
          </button>
        </div>
      </div>

      <div className="btn-row btn-row--between">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back to review
        </button>
        <button type="button" className="btn" onClick={onStartOver}>
          <Icon name="reset" size={14} />
          Start over
        </button>
      </div>
    </section>
  );
}
