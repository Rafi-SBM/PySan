# Security Policy

## Reporting a vulnerability

Report security issues privately through GitHub's
[security advisory form](https://github.com/Rafi-SBM/PySan/security/advisories/new),
not as a public issue.

Please include what the issue is, how to reproduce it, and what an attacker
could achieve. You can expect an initial response within seven days.

## Scope

PySan is a static site with no backend, no authentication and no stored user
data on any server. The areas worth looking at:

- **The collector script** (`scripts/pysan_collect.py`). It runs on a user's
  machine with their interpreter. It must stay read-only and offline. Anything
  that makes it write, install, execute or transmit is a vulnerability.
- **Input parsing** (`src/lib/parse.ts`). It consumes untrusted JSON and text.
  A crafted report must not lead to script execution or data exfiltration.
- **Generated commands** (`src/lib/commands.ts`). Package names come from
  parsed input and end up in shell commands the user copies. A name that could
  escape its position and smuggle in another command is a vulnerability. Report
  it even though the user is expected to read the command first.
- **Supply chain.** The published site loads no third-party scripts, styles or
  fonts. Anything that introduces an external origin at runtime is in scope.

## Out of scope

- The fact that PySan tells you to run `pip uninstall`. Removing packages is the
  purpose of the tool; it is destructive by design, which is why the workflow
  puts a backup step first and asks you to review the list.
- A wrong classification. That is a correctness bug, not a vulnerability. Open a
  normal issue.
- Anything requiring a user to paste attacker-supplied content into their own
  terminal without reading it.
