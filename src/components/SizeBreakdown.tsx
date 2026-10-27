import { formatPercent, formatSize } from '../lib/format';
import type { AnalysisResult } from '../types';

/** How many of the largest removal candidates get their own tile. */
const TILE_COUNT = 12;

interface SizeBreakdownProps {
  result: AnalysisResult;
}

export function SizeBreakdown({ result }: SizeBreakdownProps) {
  const { stats, remove } = result;
  if (stats.totalSize <= 0) return null;

  const keepShare = (stats.keepSize / stats.totalSize) * 100;
  const removeShare = 100 - keepShare;

  const tiles = remove
    .filter((decision) => (decision.package.size ?? 0) > 0)
    .slice(0, TILE_COUNT);

  const largest = tiles[0]?.package.size ?? 0;

  return (
    <div className="chart">
      <div
        className="chart__bar"
        role="img"
        aria-label={`${formatSize(stats.keepSize)} kept, ${formatSize(
          stats.removeSize,
        )} flagged for review`}
      >
        <div
          className="chart__segment"
          style={{ width: `${keepShare}%`, background: 'var(--success)' }}
        />
        <div
          className="chart__segment"
          style={{ width: `${removeShare}%`, background: 'var(--danger)' }}
        />
      </div>

      <div className="chart__legend">
        <span className="chart__key">
          <span className="chart__swatch" style={{ background: 'var(--success)' }} />
          Keeping {formatSize(stats.keepSize)} ({formatPercent(stats.keepSize, stats.totalSize)})
        </span>
        <span className="chart__key">
          <span className="chart__swatch" style={{ background: 'var(--danger)' }} />
          Reviewing {formatSize(stats.removeSize)} (
          {formatPercent(stats.removeSize, stats.totalSize)})
        </span>
      </div>

      {tiles.length > 0 && (
        <>
          <p
            className="card__hint"
            style={{ marginTop: 'var(--space-5)', fontSize: '0.8125rem' }}
          >
            Largest removal candidates
          </p>
          <div className="treemap">
            {tiles.map((decision) => {
              const size = decision.package.size ?? 0;
              // Tile area tracks size, with a floor so small entries stay readable.
              const basis = Math.max(14, Math.round((size / largest) * 100));
              return (
                <div
                  className="treemap__cell"
                  key={decision.package.id}
                  style={{ flex: `1 1 ${basis}px`, minHeight: 56 }}
                  title={`${decision.package.name} ${formatSize(size)}`}
                >
                  <div style={{ minWidth: 0, width: '100%' }}>
                    <span>{decision.package.name}</span>
                    <small>{formatSize(size)}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
