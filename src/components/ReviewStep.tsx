import { Icon } from './Icon';
import { Notice } from './Notice';
import { PackageTable } from './PackageTable';
import { SizeBreakdown } from './SizeBreakdown';
import { formatCount, formatSize } from '../lib/format';
import type { AnalysisResult, OverrideMode, Overrides } from '../types';

interface ReviewStepProps {
  result: AnalysisResult;
  overrides: Overrides;
  onOverride: (id: string, mode: OverrideMode | null) => void;
  onResetOverrides: () => void;
  hasDependencyMetadata: boolean;
  hasSizeMetadata: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export function ReviewStep({
  result,
  overrides,
  onOverride,
  onResetOverrides,
  hasDependencyMetadata,
  hasSizeMetadata,
  onBack,
  onContinue,
}: ReviewStepProps) {
  const { stats } = result;
  const overrideCount = Object.keys(overrides).length;
  const allDecisions = [...result.keep, ...result.remove];

  return (
    <section aria-labelledby="review-heading">
      <h2 className="visually-hidden" id="review-heading">
        Review the analysis
      </h2>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat__label">
            <Icon name="package" size={14} />
            Analyzed
          </div>
          <div className="stat__value">{stats.totalPackages.toLocaleString('en-US')}</div>
          <div className="stat__meta">
            {hasSizeMetadata ? formatSize(stats.totalSize) : 'sizes unavailable'}
          </div>
        </div>

        <div className="stat stat--keep">
          <div className="stat__label">
            <Icon name="shield" size={14} />
            Keeping
          </div>
          <div className="stat__value">{formatSize(stats.keepSize)}</div>
          <div className="stat__meta">{formatCount(stats.keepCount, 'package')}</div>
        </div>

        <div className="stat stat--remove">
          <div className="stat__label">
            <Icon name="trash" size={14} />
            Reclaimable
          </div>
          <div className="stat__value">{formatSize(stats.removeSize)}</div>
          <div className="stat__meta">{formatCount(stats.removeCount, 'package')} flagged</div>
        </div>

        <div className="stat">
          <div className="stat__label">
            <Icon name="link" size={14} />
            Kept as dependencies
          </div>
          <div className="stat__value">{stats.dependencyCount.toLocaleString('en-US')}</div>
          <div className="stat__meta">
            {hasDependencyMetadata ? 'needed by packages you use' : 'not checked'}
          </div>
        </div>
      </div>

      <div className="card">
        <SizeBreakdown result={result} />

        {result.warnings.map((warning) => (
          <Notice tone="danger" key={warning} title="Conflicting choice">
            {warning}
          </Notice>
        ))}

        {hasDependencyMetadata ? (
          <Notice tone="info" title="Every flagged package was dependency checked">
            {formatCount(stats.dependencyCount, 'package')} matched no profile but stayed in
            the keep set because something you use requires it. Nothing in the flagged list
            is needed by a package you are keeping.
          </Notice>
        ) : (
          <Notice tone="warning" title="Flagged packages were not dependency checked">
            This report carries no dependency metadata, so a flagged package could still be
            required by one you keep. Re-run the collector script before uninstalling
            anything.
          </Notice>
        )}

        {stats.unsizedCount > 0 && (
          <Notice tone="info">
            {formatCount(stats.unsizedCount, 'package')} could not be measured, so the
            reclaimable figure is a lower bound.
          </Notice>
        )}

        {result.missingDependencies.length > 0 && (
          <details className="detail">
            <summary>
              <Icon name="chevron-right" size={14} />
              {formatCount(result.missingDependencies.length, 'declared dependency', 'declared dependencies')}{' '}
              not installed
            </summary>
            <div className="detail__body">
              <p>
                These are required unconditionally by installed packages but are absent
                from the environment, which usually means an interrupted install or a
                package removed by hand. Requirements gated by an environment marker, such
                as a Windows-only or older-Python dependency, are not counted here.
                Reinstalling the affected packages is worth doing before any further
                cleanup.
              </p>
              <ul className="tag-list" style={{ marginTop: 'var(--space-3)' }}>
                {result.missingDependencies.slice(0, 40).map((entry) => (
                  <li className="badge badge--warning" key={entry.name}>
                    {entry.name}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}
      </div>

      <PackageTable
        decisions={allDecisions}
        overrides={overrides}
        onOverride={onOverride}
      />

      <div className="btn-row btn-row--between" style={{ marginTop: 'var(--space-5)' }}>
        <div className="btn-row">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          {overrideCount > 0 && (
            <button type="button" className="btn" onClick={onResetOverrides}>
              <Icon name="reset" size={14} />
              Reset {formatCount(overrideCount, 'manual change')}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={onContinue}
          disabled={stats.removeCount === 0}
        >
          {stats.removeCount === 0 ? 'Nothing to clean up' : 'Get the cleanup commands'}
          <Icon name="chevron-right" size={15} />
        </button>
      </div>
    </section>
  );
}
