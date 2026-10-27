import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { formatSize } from '../lib/format';
import { REASON_LABELS } from '../lib/export';
import { profileLabel } from '../lib/profiles';
import type { Decision, OverrideMode, Overrides } from '../types';

type SortKey = 'size' | 'name' | 'reason';
type Filter = 'all' | 'keep' | 'remove';

/** Rows rendered before the table asks the user to confirm showing everything. */
const SOFT_ROW_LIMIT = 400;

function reasonText(decision: Decision): string {
  const { reason } = decision;
  switch (reason.kind) {
    case 'protected':
      return 'Packaging tooling, never removed';
    case 'profile':
      return reason.profileKeys.map(profileLabel).join(', ');
    case 'dependency':
      return reason.requiredBy.length === 0
        ? 'Required by a kept package'
        : `Required by ${reason.requiredBy.slice(0, 3).join(', ')}${
            reason.requiredBy.length > 3 ? ` and ${reason.requiredBy.length - 3} more` : ''
          }`;
    case 'user-keep':
      return 'Kept by you';
    case 'user-remove':
      return 'Marked for removal by you';
    case 'unmatched':
      return 'No selected profile needs it';
  }
}

function badgeClass(decision: Decision): string {
  if (!decision.keep) return 'badge badge--danger';
  if (decision.reason.kind === 'protected') return 'badge';
  if (decision.reason.kind === 'dependency') return 'badge badge--accent';
  return 'badge badge--success';
}

interface PackageTableProps {
  decisions: readonly Decision[];
  overrides: Overrides;
  onOverride: (id: string, mode: OverrideMode | null) => void;
}

export function PackageTable({ decisions, overrides, onOverride }: PackageTableProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('size');
  const [ascending, setAscending] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = decisions.filter((decision) => {
      if (filter === 'keep' && !decision.keep) return false;
      if (filter === 'remove' && decision.keep) return false;
      if (needle === '') return true;
      return (
        decision.package.id.includes(needle) ||
        decision.package.name.toLowerCase().includes(needle)
      );
    });

    const direction = ascending ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.package.id.localeCompare(b.package.id) * direction;
      if (sortKey === 'reason') {
        const delta = REASON_LABELS[a.reason.kind].localeCompare(REASON_LABELS[b.reason.kind]);
        return (delta !== 0 ? delta : a.package.id.localeCompare(b.package.id)) * direction;
      }
      const delta = (a.package.size ?? -1) - (b.package.size ?? -1);
      return (delta !== 0 ? delta : b.package.id.localeCompare(a.package.id)) * direction;
    });
  }, [decisions, query, filter, sortKey, ascending]);

  const visible = showAll ? rows : rows.slice(0, SOFT_ROW_LIMIT);
  const hidden = rows.length - visible.length;

  const sortButton = (key: SortKey, label: string) => (
    <button
      type="button"
      className="table__sort"
      aria-sort={
        sortKey === key ? (ascending ? 'ascending' : 'descending') : undefined
      }
      onClick={() => {
        if (sortKey === key) setAscending((value) => !value);
        else {
          setSortKey(key);
          setAscending(key === 'name');
        }
      }}
    >
      {label}
      {sortKey === key && (
        <Icon name={ascending ? 'chevron-down' : 'chevron-down'} size={12} />
      )}
    </button>
  );

  return (
    <div className="card card--flush">
      <div className="table-toolbar">
        <div className="search">
          <Icon name="search" size={15} />
          <input
            type="search"
            className="input"
            placeholder="Filter packages"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter packages by name"
          />
        </div>

        <div className="seg" role="group" aria-label="Show">
          {(
            [
              ['all', 'All'],
              ['keep', 'Keeping'],
              ['remove', 'Removing'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="badge">
          {rows.length === decisions.length
            ? `${decisions.length} packages`
            : `${rows.length} of ${decisions.length}`}
        </span>
      </div>

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{sortButton('name', 'Package')}</th>
              <th scope="col" className="col-num">
                {sortButton('size', 'Size')}
              </th>
              <th scope="col" className="col-tight">
                {sortButton('reason', 'Decision')}
              </th>
              <th scope="col">Why</th>
              <th scope="col" className="col-tight">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((decision) => {
              const { package: pkg } = decision;
              const override = overrides[pkg.id];
              const locked = decision.reason.kind === 'protected';

              return (
                <tr key={pkg.id} className={decision.keep ? undefined : 'row--removing'}>
                  <td>
                    <span className="pkg-name">
                      {pkg.name}
                      {pkg.editable && <span className="badge">editable</span>}
                      {override && <span className="badge badge--accent">manual</span>}
                    </span>
                    {pkg.version && <span className="pkg-version">{pkg.version}</span>}
                  </td>
                  <td className="col-num">{formatSize(pkg.size)}</td>
                  <td className="col-tight">
                    <span className={badgeClass(decision)}>
                      {REASON_LABELS[decision.reason.kind]}
                    </span>
                  </td>
                  <td className="pkg-reason">{reasonText(decision)}</td>
                  <td className="col-tight">
                    {locked ? (
                      <span className="badge" title="Protected packaging tooling">
                        <Icon name="lock" size={11} />
                        locked
                      </span>
                    ) : override ? (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => onOverride(pkg.id, null)}
                      >
                        <Icon name="reset" size={13} />
                        Reset
                      </button>
                    ) : decision.keep ? (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => onOverride(pkg.id, 'remove')}
                      >
                        <Icon name="trash" size={13} />
                        Remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => onOverride(pkg.id, 'keep')}
                      >
                        <Icon name="shield" size={13} />
                        Keep
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="empty">No packages match this filter.</p>
        )}

        {hidden > 0 && (
          <p className="empty">
            {hidden} more row{hidden === 1 ? '' : 's'} hidden for performance.{' '}
            <button type="button" className="btn btn--ghost" onClick={() => setShowAll(true)}>
              Show all
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
