# Contributing to PySan

Thanks for taking the time. Bug reports about packages PySan classified wrongly
are the most valuable contribution, because the profile data is the part that
can only improve through real-world use.

## Getting set up

```bash
git clone https://github.com/Rafi-SBM/PySan.git
cd PySan
npm install
npm run dev
```

Node 20.19 or newer. The version in `.nvmrc` is what CI uses.

## Before opening a pull request

```bash
npm run verify
```

That runs lint, the type checker, the production build and the test suite, which
is exactly what CI runs. A green `verify` means CI will pass.

## Reporting a misclassification

This is the report that helps most. Include:

- The package name and version.
- Which profiles you had selected.
- What PySan decided, and what it should have decided.
- What you use the package for.

If you can, attach the relevant entry from your collector report. It carries the
dependency metadata that explains the decision.

## Changing profile data

Profiles live in [`src/lib/profiles.ts`](src/lib/profiles.ts) as plain data.

- Entries are PEP 503 normalized names: lowercase, with `-` in place of any run
  of `.`, `_` or `-`. So `zope.interface` is written `zope-interface`.
- A trailing `*` claims a namespace: `azure-*` matches `azure-storage-blob` but
  not `azurerm`.
- Do not rely on prefixes without a `*`. Matching is exact by design, so that
  `six` cannot claim `sixpack`.
- Add a test in `src/lib/analyze.test.ts` for anything subtle, particularly a
  name that could be confused with another project.

Adding a package to `PROTECTED_PACKAGES` is a stronger claim: it makes the
package impossible to remove through PySan at all. Reserve that for packaging
and build tooling whose removal breaks the environment or the ability to fix it.

## Code conventions

- The analysis engine in `src/lib` must not import React or touch the DOM. It is
  tested directly, and that boundary is what keeps it testable.
- Components handle presentation. Decisions belong in the engine.
- Comments explain why, not what. If a line needs a comment to say what it does,
  rename something instead.
- No emoji in source, UI copy, documentation or commit messages.
- No new runtime dependencies without a reason in the pull request description.
  The shipped bundle is deliberately small and has no third-party runtime code
  beyond React.

## Testing expectations

- Every change to `src/lib` needs a test.
- Test behaviour, not implementation. Assert on what a user of the function
  gets, not on how it got there.
- For anything touching classification, add a case to the invariant suite if the
  property is general rather than specific.

## Changes to the collector script

`scripts/pysan_collect.py` runs on other people's interpreters, so it holds to
stricter rules than the rest of the project:

- Standard library only. No third-party imports, including `packaging`.
- Python 3.8 compatible.
- Read-only. It must never write to, install into or modify the environment it
  inspects, and must never open a network connection.
- Every filesystem access is wrapped: a permission error on one file must not
  abort the run.

The script is read into the app at build time from this one file, so there is
no second copy to keep in sync.

## Commit messages

Short and imperative. One concern per commit.

## Security

Do not open a public issue for a security problem. See
[SECURITY.md](SECURITY.md).
