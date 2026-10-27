# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-27

First production release. The analysis engine was rewritten, and the previous
recommendations should not be relied on: they could suggest removing a package
that something else required.

### Added

- **Dependency-aware classification.** Package metadata is parsed into a
  dependency graph, and the keep set is expanded across it. A package that
  matches no profile is still kept when something you use requires it.
- **Reason for every decision.** Each package reports why it is kept or
  flagged, naming the profile that matched or the packages that require it.
- **Manual overrides.** Any decision can be flipped per package, with a warning
  when a removal would break something kept.
- **Protected packages.** Packaging and build tooling cannot be removed through
  PySan at all, including by override.
- **Multi-format input.** Collector reports, legacy JSON arrays,
  `pip list --format=json` and `pip freeze` text, with the format detected
  automatically and missing capabilities stated explicitly.
- **File upload and drag-and-drop**, alongside the existing paste box.
- **Searchable, sortable, filterable package table** replacing the two static
  lists.
- **Size breakdown** showing the keep/review split and the largest candidates.
- **Backup and restore commands** as the first and last steps of cleanup.
- **Command generation for pip, uv, pipenv, poetry and conda**, for POSIX
  shells, PowerShell and cmd, chunked to stay under command line length limits,
  with a requirements-file form that avoids the limit entirely.
- **Report export** as a removal list, a pinned keep list, JSON, CSV and
  Markdown.
- **Missing dependency detection** for packages required but not installed,
  excluding requirements gated by environment markers.
- **Light and dark themes**, following the system setting and persisted on
  choice, applied before first paint.
- **Test suite** of unit, integration and invariant tests, with an opt-in suite
  that runs the engine over your own environment.
- **CI and automated deployment** through GitHub Actions.
- `CONTRIBUTING.md`, `SECURITY.md` and this changelog.

### Changed

- **The collector script no longer requires `tkinter`**, which is absent from
  many Linux Python installations and made the previous version unusable there.
  It is now a command line tool with `--output`, `--no-sizes`, `--indent` and
  `--quiet`, and prints to stdout by default.
- **The collector records dependency metadata**, install location, editable
  status and file counts in a versioned schema.
- **Name matching follows PEP 503.** Normalization is applied consistently, and
  duplicate distributions on the interpreter path are merged.
- **Font Awesome and Google Fonts are gone.** Icons are inline SVG and the font
  stack is the system one, so the published site loads no third-party origin.
- **Syntax highlighting tokenizes the real script** instead of rendering a
  hand-maintained HTML copy through `dangerouslySetInnerHTML`.
- **Persisted state is debounced** rather than written on every keystroke.
- The interface is a four-step flow with a stepper, replacing the single
  scrolling page.

### Fixed

- **Removal of required dependencies.** The previous version classified by
  profile membership alone, so any package not in a profile list was offered
  for removal even when installed packages required it.
- **Prefix name collisions.** `startsWith` matching meant `six` claimed
  `sixpack` and `pip` claimed `pipenv`. Matching is now exact unless a pattern
  explicitly ends in `*`.
- **Protected tooling could be flagged** when profiles did not cover it.
- **Silent failure on malformed input.** Parse errors now explain what was
  wrong and which formats are accepted, and a render error no longer leaves a
  blank page.
- **Sizes of zero and unmeasured sizes were indistinguishable**, both shown as
  `0 B`. An unmeasured size now reads as unknown and is reported separately.
- **Long uninstall commands** could exceed the shell's argument limit and fail
  partway. Commands are chunked, and a requirements-file form is offered.
- **Duplicate distributions** on the interpreter path were counted twice.

### Security

- No third-party runtime code beyond React, and no external origins at runtime.
- The collector is read-only and offline by construction.

[1.0.0]: https://github.com/Rafi-SBM/PySan/releases/tag/v1.0.0
