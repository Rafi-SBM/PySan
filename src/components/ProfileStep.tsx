import { useMemo } from 'react';
import { Icon } from './Icon';
import { Notice } from './Notice';
import { PROFILES } from '../lib/profiles';
import { matchesPattern } from '../lib/normalize';
import { formatCount } from '../lib/format';
import type { Package } from '../types';

interface ProfileStepProps {
  packages: readonly Package[];
  selected: readonly string[];
  onChange: (profiles: string[]) => void;
  includeOptional: boolean;
  onIncludeOptionalChange: (value: boolean) => void;
  hasDependencyMetadata: boolean;
  onBack: () => void;
  onContinue: () => void;
}

export function ProfileStep({
  packages,
  selected,
  onChange,
  includeOptional,
  onIncludeOptionalChange,
  hasDependencyMetadata,
  onBack,
  onContinue,
}: ProfileStepProps) {
  /** How many installed packages each profile actually accounts for. */
  const matchCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const profile of PROFILES) {
      let count = 0;
      for (const pkg of packages) {
        if (profile.packages.some((pattern) => matchesPattern(pkg.id, pattern))) count += 1;
      }
      counts.set(profile.key, count);
    }
    return counts;
  }, [packages]);

  const suggested = useMemo(
    () =>
      PROFILES.filter((profile) => (matchCounts.get(profile.key) ?? 0) >= 3).map(
        (profile) => profile.key,
      ),
    [matchCounts],
  );

  const toggle = (key: string, checked: boolean) => {
    onChange(checked ? [...selected, key] : selected.filter((entry) => entry !== key));
  };

  return (
    <section aria-labelledby="profiles-heading">
      <div className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title" id="profiles-heading">
              What do you use this environment for?
            </h2>
            <p className="card__hint">
              Selected profiles anchor the keep set. Anything those packages depend on is
              kept too, so a package is only flagged when nothing you rely on needs it.
            </p>
          </div>
        </div>

        {!hasDependencyMetadata && (
          <Notice tone="warning" title="Dependency checking is unavailable">
            This report has no dependency metadata, so PySan cannot confirm that a flagged
            package is unused by something you keep. Re-run the collector script for a
            safety-checked result, and treat the current list as a starting point only.
          </Notice>
        )}

        <div className="btn-row" style={{ marginBottom: 'var(--space-4)' }}>
          <button
            type="button"
            className="btn"
            onClick={() => onChange(suggested)}
            disabled={suggested.length === 0}
          >
            <Icon name="check" size={14} />
            Select suggested ({suggested.length})
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => onChange(PROFILES.map((profile) => profile.key))}
          >
            Select all
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onChange([])}
            disabled={selected.length === 0}
          >
            Clear
          </button>
        </div>

        <div className="profile-grid">
          {PROFILES.map((profile) => {
            const count = matchCounts.get(profile.key) ?? 0;
            return (
              <label className="profile" key={profile.key}>
                <input
                  type="checkbox"
                  checked={selected.includes(profile.key)}
                  onChange={(event) => toggle(profile.key, event.target.checked)}
                />
                <span>
                  <span className="profile__label">{profile.label}</span>
                  <span className="profile__desc">{profile.description}</span>
                  <span className="profile__count">
                    {count === 0 ? 'No matches installed' : `${formatCount(count, 'match', 'matches')} installed`}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <details className="detail">
          <summary>
            <Icon name="chevron-right" size={14} />
            Advanced
          </summary>
          <div className="detail__body">
            <label className="switch" style={{ marginBottom: 'var(--space-3)' }}>
              <input
                type="checkbox"
                checked={includeOptional}
                onChange={(event) => onIncludeOptionalChange(event.target.checked)}
              />
              <span className="switch__track" aria-hidden="true" />
              Keep optional extras of the packages you use
            </label>
            <p>
              Many projects declare optional dependency groups, such as the packages behind
              <code> pip install requests[socks]</code>. By default these are treated as
              removable, since the extra may never have been installed deliberately. Turn
              this on to keep them, which is the more conservative choice.
            </p>
          </div>
        </details>

        <div className="btn-row btn-row--between" style={{ marginTop: 'var(--space-5)' }}>
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="btn btn--primary btn--lg"
            onClick={onContinue}
            disabled={selected.length === 0}
          >
            Analyze {formatCount(packages.length, 'package')}
            <Icon name="chevron-right" size={15} />
          </button>
        </div>

        {selected.length === 0 && (
          <p className="card__hint" style={{ marginTop: 'var(--space-3)' }}>
            Select at least one profile. Without one, every package outside the protected
            packaging tools would be flagged for removal.
          </p>
        )}
      </div>
    </section>
  );
}
