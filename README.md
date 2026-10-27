# PySan

**Find the bloat in a Python environment without breaking it.**

PySan measures every installed distribution, works out which ones nothing you
actually use depends on, and generates the commands to remove them. It runs
entirely in your browser: your package data is never uploaded, and PySan never
touches your environment itself.

**[Open PySan](https://rafi-sbm.github.io/PySan/)**

---

## Why not just delete the big packages

Because the big packages are usually load-bearing.

A naive "largest packages" list tells you `nvidia-cublas-cu12` is 400 MB. It
does not tell you that `torch` requires it, and that removing it leaves you with
a `torch` that imports and then segfaults. Dependency metadata is the difference
between a cleanup and an outage.

PySan builds the dependency graph from each distribution's `Requires-Dist`
metadata and refuses to flag anything reachable from a package you said you
need. On a typical environment that keeps a dozen or more packages that a
size-sorted list would have told you to delete.

## How it works

1. **Collect.** Run `scripts/pysan_collect.py` with the interpreter you want to
   inspect. It reads package metadata and sizes from disk and writes a JSON
   report. Standard library only, no network access, no writes to the
   environment.
2. **Choose profiles.** Say what the environment is for: data science, web
   backend, DevOps, testing, and so on. Selected profiles anchor the keep set.
3. **Review.** PySan expands the keep set across the dependency graph, then
   shows every package with the reason for its decision. Override anything.
4. **Clean up.** Get a backup command, a reviewable removal list, the uninstall
   command for your package manager, and the command to restore if needed.

## Classification rules

Applied in order, first match wins:

| Rule | Outcome | Rationale |
| --- | --- | --- |
| Packaging tooling (`pip`, `setuptools`, `wheel`, `uv`, ...) | Always kept | Removing these breaks the environment and the tools that would repair it. |
| Manually pinned by you | Kept | Your call overrides the heuristics. |
| Manually marked for removal | Flagged | Same, with a warning if something kept still needs it. |
| Matches a selected profile | Kept | This is what you said you use. |
| Reachable from a kept package via `Requires-Dist` | Kept | Removing it would break something that stays. |
| Everything else | Flagged for review | Nothing you selected needs it, directly or indirectly. |

"Flagged for review" means exactly that. PySan does not uninstall anything; it
produces commands for you to read and run.

## Supported input formats

| Format | Sizes | Dependency checking |
| --- | --- | --- |
| `pysan_collect.py` output | Yes | Yes |
| Legacy PySan JSON array | Yes | No |
| `pip list --format=json` | No | No |
| `pip freeze` / `requirements.txt` | No | No |

Formats without dependency metadata still produce an analysis, but PySan says
plainly that it could not verify safety. Prefer the collector.

## Using the collector

```bash
# Inspect the active environment and write a report
python scripts/pysan_collect.py -o pysan-environment.json

# Inspect a specific interpreter
/path/to/venv/bin/python scripts/pysan_collect.py -o report.json

# Print to stdout and pipe it somewhere
python scripts/pysan_collect.py --quiet | gzip > report.json.gz

# Skip size measurement, which is the slow part on large environments
python scripts/pysan_collect.py --no-sizes -o report.json
```

| Flag | Effect |
| --- | --- |
| `-o, --output PATH` | Write to a file instead of stdout. |
| `--no-sizes` | Skip size measurement. |
| `--indent N` | JSON indentation; `0` for a single compact line. |
| `-q, --quiet` | No progress output on stderr. |

Requires Python 3.8 or newer.

## Privacy

There is no backend. No analytics, no telemetry, no third-party scripts, no
webfonts, no icon CDN. The entire site is static files, and every byte of
analysis happens in your browser's memory.

`localStorage` holds your pasted report and profile selection so a refresh does
not lose your place. **Start over** clears it. If storage is unavailable, the app
works normally for the session.

## Safety

PySan generates commands; it never runs them. Before you run anything it gives
you:

- A backup command (`pip freeze > requirements.backup.txt`) and the matching
  restore command.
- A downloadable `pysan-remove.txt` you can open and edit before using it.
- A warning if you override a decision in a way that breaks a dependency.

Two things PySan cannot know, which are worth stating plainly:

- **Dynamic imports.** A package loaded by name at runtime, through a plugin
  system or an entry point, declares no dependency edge. If a tool loads
  plugins, keep them explicitly.
- **Your own code.** PySan reads the environment, not your project. A package
  imported only by a script of yours looks unused. Reviewing the flagged list is
  the step that catches this, which is why it is a review and not an action.

Prefer running cleanups against a virtual environment. Removing packages from a
system Python can break operating system tooling.

## Development

```bash
npm install
npm run dev        # dev server on http://localhost:5173
npm test           # test suite
npm run verify     # lint, typecheck, build and test, as CI does
```

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | Typecheck and build to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | ESLint over the project. |
| `npm test` | Vitest, single run. |
| `npm run test:watch` | Vitest in watch mode. |
| `npm run test:coverage` | Coverage report for `src/lib`. |
| `npm run verify` | Everything CI runs. |

Run the engine over your own environment rather than fixtures:

```bash
python scripts/pysan_collect.py -o /tmp/env.json
PYSAN_SAMPLE=/tmp/env.json npm test
```

That enables the invariant suite in `src/lib/invariants.test.ts`, which asserts
properties that must hold for any input: every package lands on exactly one
side, sizes add up, and nothing required by a kept package is ever flagged.

### Layout

```
scripts/pysan_collect.py   Metadata collector, standard library only
src/lib/                   Analysis engine, no React imports
  normalize.ts             PEP 503 name normalization and pattern matching
  requirements.ts          PEP 508 dependency specifier parsing
  parse.ts                 Multi-format input parsing and validation
  graph.ts                 Dependency graph and transitive closure
  analyze.ts               Classification into keep and review
  profiles.ts              Curated profile definitions
  commands.ts              Uninstall command generation
  export.ts                Report generation
  highlight.ts             Python tokenizer for display
src/components/            React components, presentation only
src/hooks/                 Theme and persisted state
src/types/                 Shared types
```

The engine in `src/lib` has no dependency on React or the DOM, so it is tested
directly and could be lifted into a CLI unchanged.

### Adding or correcting a profile

Profiles are plain data in [`src/lib/profiles.ts`](src/lib/profiles.ts). Entries
are PEP 503 normalized names, optionally ending in `*` to claim a namespace:

```ts
packages: ['pandas', 'numpy', 'jupyter-*']
```

Matching is never implicitly prefix-based, which is deliberate: `six` must not
claim `sixpack`, and `pip` must not claim `pipenv`. Use an explicit `*` when you
mean a namespace.

If PySan flags something it should not, that is a profile gap and a bug worth
reporting. Include the package name and what you use it for.

## Deployment

The site is static. Any host works.

Pushes to `main` build and deploy to GitHub Pages through
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). The base path
comes from the `PYSAN_BASE` environment variable and defaults to `/PySan/` for a
project page:

```bash
PYSAN_BASE=/ npm run build     # root domain or custom domain
npm run build                  # GitHub Pages project site
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports that include the package
PySan got wrong are the most useful kind.

## License

[MIT](LICENSE).
