import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CleanupStep } from './components/CleanupStep';
import { Icon } from './components/Icon';
import { ImportStep } from './components/ImportStep';
import { ProfileStep } from './components/ProfileStep';
import { ReviewStep } from './components/ReviewStep';
import { Stepper, type StepDefinition, type StepId } from './components/Stepper';
import { usePersistentState } from './hooks/usePersistentState';
import { useTheme } from './hooks/useTheme';
import { analyzeEnvironment } from './lib/analyze';
import { ParseError, parseEnvironmentData } from './lib/parse';
import type { OverrideMode, Overrides, ParsedEnvironment } from './types';

const REPOSITORY_URL = 'https://github.com/Rafi-SBM/PySan';

export default function App() {
  const [theme, toggleTheme] = useTheme();

  const [rawData, setRawData, clearRawData] = usePersistentState<string>('pysan.data', '');
  const [profiles, setProfiles] = usePersistentState<string[]>('pysan.profiles', []);
  const [includeOptional, setIncludeOptional] = usePersistentState<boolean>(
    'pysan.includeOptional',
    false,
  );

  const [overrides, setOverrides] = useState<Overrides>({});
  const [step, setStep] = useState<StepId>('import');
  const mainRef = useRef<HTMLElement>(null);

  const { parsed, parseError } = useMemo<{
    parsed: ParsedEnvironment | null;
    parseError: string | null;
  }>(() => {
    if (rawData.trim() === '') return { parsed: null, parseError: null };
    try {
      return { parsed: parseEnvironmentData(rawData), parseError: null };
    } catch (error) {
      if (error instanceof ParseError) return { parsed: null, parseError: error.message };
      return {
        parsed: null,
        parseError: error instanceof Error ? error.message : 'Unknown parsing error.',
      };
    }
  }, [rawData]);

  const analysis = useMemo(() => {
    if (!parsed || profiles.length === 0) return null;
    return analyzeEnvironment(parsed.packages, { profiles, overrides, includeOptional });
  }, [parsed, profiles, overrides, includeOptional]);

  // Keep the step pointer honest: never show a step whose input is gone.
  useEffect(() => {
    if (!parsed && step !== 'import') setStep('import');
    else if (!analysis && (step === 'review' || step === 'cleanup')) setStep('profiles');
  }, [parsed, analysis, step]);

  const goTo = useCallback((next: StepId) => {
    setStep(next);
    requestAnimationFrame(() => {
      mainRef.current?.scrollIntoView({ block: 'start' });
    });
  }, []);

  const handleOverride = useCallback((id: string, mode: OverrideMode | null) => {
    setOverrides((current) => {
      const next = { ...current };
      if (mode === null) delete next[id];
      else next[id] = mode;
      return next;
    });
  }, []);

  const handleStartOver = useCallback(() => {
    clearRawData();
    setProfiles([]);
    setOverrides({});
    setStep('import');
    window.scrollTo({ top: 0 });
  }, [clearRawData, setProfiles]);

  const steps = useMemo<StepDefinition[]>(
    () => [
      {
        id: 'import',
        label: 'Import',
        available: true,
        complete: parsed !== null,
      },
      {
        id: 'profiles',
        label: 'Profiles',
        available: parsed !== null,
        complete: parsed !== null && profiles.length > 0,
      },
      {
        id: 'review',
        label: 'Review',
        available: analysis !== null,
        complete: analysis !== null,
      },
      {
        id: 'cleanup',
        label: 'Clean up',
        available: analysis !== null && analysis.stats.removeCount > 0,
        complete: false,
      },
    ],
    [parsed, profiles.length, analysis],
  );

  return (
    <div className="app">
      <header className="masthead">
        <div className="shell masthead__inner">
          <div className="brand">
            <span className="brand__mark" aria-hidden="true">
              <Icon name="package" size={18} />
            </span>
            <span>
              <span className="brand__name">PySan</span>{' '}
              <span className="brand__tagline">Python environment analyzer</span>
            </span>
          </div>

          <div className="masthead__actions">
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
            <a
              className="btn btn--ghost"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Source
              <Icon name="external" size={14} />
            </a>
          </div>
        </div>
      </header>

      {step === 'import' && !parsed && (
        <div className="shell hero">
          <h1>See what your Python environment is actually carrying</h1>
          <p>
            PySan measures every installed package, works out which ones nothing you use
            depends on, and writes the commands to remove them. It runs entirely in your
            browser.
          </p>
          <div className="hero__badges">
            <span className="badge badge--success">
              <Icon name="lock" size={12} />
              No upload, no server
            </span>
            <span className="badge badge--accent">
              <Icon name="link" size={12} />
              Dependency checked
            </span>
            <span className="badge">
              <Icon name="shield" size={12} />
              Backup step included
            </span>
          </div>
        </div>
      )}

      <div className="shell">
        <Stepper steps={steps} current={step} onSelect={goTo} />
      </div>

      <main className="shell" ref={mainRef} style={{ paddingBottom: 'var(--space-7)' }}>
        {step === 'import' && (
          <ImportStep
            value={rawData}
            onChange={setRawData}
            parsed={parsed}
            parseError={parseError}
            onContinue={() => goTo('profiles')}
            onClear={handleStartOver}
          />
        )}

        {step === 'profiles' && parsed && (
          <ProfileStep
            packages={parsed.packages}
            selected={profiles}
            onChange={setProfiles}
            includeOptional={includeOptional}
            onIncludeOptionalChange={setIncludeOptional}
            hasDependencyMetadata={parsed.environment.hasDependencyMetadata}
            onBack={() => goTo('import')}
            onContinue={() => goTo('review')}
          />
        )}

        {step === 'review' && parsed && analysis && (
          <ReviewStep
            result={analysis}
            overrides={overrides}
            onOverride={handleOverride}
            onResetOverrides={() => setOverrides({})}
            hasDependencyMetadata={parsed.environment.hasDependencyMetadata}
            hasSizeMetadata={parsed.environment.hasSizeMetadata}
            onBack={() => goTo('profiles')}
            onContinue={() => goTo('cleanup')}
          />
        )}

        {step === 'cleanup' && parsed && analysis && (
          <CleanupStep
            result={analysis}
            environment={parsed.environment}
            profiles={profiles}
            onBack={() => goTo('review')}
            onStartOver={handleStartOver}
          />
        )}
      </main>

      <footer className="footer">
        <div className="shell footer__inner">
          <p>
            Everything runs locally. Your package data never leaves this browser, and PySan
            never changes your environment: it only tells you what to run.
          </p>
          <nav className="footer__links" aria-label="Project links">
            <a href={REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
              Repository
            </a>
            <a
              href={`${REPOSITORY_URL}/issues/new`}
              target="_blank"
              rel="noreferrer noopener"
            >
              Report an issue
            </a>
            <a
              href={`${REPOSITORY_URL}/blob/main/LICENSE`}
              target="_blank"
              rel="noreferrer noopener"
            >
              MIT License
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
