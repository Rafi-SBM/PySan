/**
 * Uninstall command generation.
 *
 * Package lists get long, and a single `pip uninstall a b c ...` line can
 * exceed the shell's argument limit. Commands are therefore chunked, and a
 * requirements-file variant is offered as the form that does not break.
 */

import type { Package } from '../types';

export type PackageManager = 'pip' | 'uv' | 'pipenv' | 'poetry' | 'conda';
export type Shell = 'posix' | 'powershell' | 'cmd';

export const PACKAGE_MANAGERS: { value: PackageManager; label: string }[] = [
  { value: 'pip', label: 'pip' },
  { value: 'uv', label: 'uv' },
  { value: 'pipenv', label: 'pipenv' },
  { value: 'poetry', label: 'poetry' },
  { value: 'conda', label: 'conda' },
];

export const SHELLS: { value: Shell; label: string }[] = [
  { value: 'posix', label: 'macOS / Linux' },
  { value: 'powershell', label: 'Windows PowerShell' },
  { value: 'cmd', label: 'Windows cmd' },
];

/** Conservative budget for one command line, well under every platform limit. */
const MAX_COMMAND_LENGTH = 6000;

export const REMOVE_FILE_NAME = 'pysan-remove.txt';
export const BACKUP_FILE_NAME = 'requirements.backup.txt';

function uninstallPrefix(manager: PackageManager): string {
  switch (manager) {
    case 'uv':
      return 'uv pip uninstall';
    case 'pipenv':
      return 'pipenv uninstall';
    case 'poetry':
      return 'poetry remove';
    case 'conda':
      return 'conda remove --yes';
    case 'pip':
    default:
      return 'python -m pip uninstall --yes';
  }
}

/** Split names into groups whose rendered command stays under the length budget. */
export function chunkNames(names: readonly string[], prefixLength: number): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let length = prefixLength;

  for (const name of names) {
    const addition = name.length + 1;
    if (current.length > 0 && length + addition > MAX_COMMAND_LENGTH) {
      chunks.push(current);
      current = [];
      length = prefixLength;
    }
    current.push(name);
    length += addition;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export interface CommandPlan {
  /** Back up the environment before changing it. */
  backup: string;
  /** Uninstall using a requirements file, the form that never hits argv limits. */
  fromFile: string;
  /** Uninstall by listing names on the command line, chunked where needed. */
  inline: string[];
  /** Restore from the backup if something goes wrong. */
  restore: string;
  /** Whether the inline form had to be split into several commands. */
  chunked: boolean;
}

export function buildCommandPlan(
  packages: readonly Package[],
  manager: PackageManager,
  shell: Shell,
): CommandPlan {
  const names = packages.map((pkg) => pkg.name);
  const prefix = uninstallPrefix(manager);
  const chunks = chunkNames(names, prefix.length);

  const inline = chunks.map((chunk) => `${prefix} ${chunk.join(' ')}`);

  const backup =
    manager === 'conda'
      ? `conda list --export > ${BACKUP_FILE_NAME}`
      : `python -m pip freeze > ${BACKUP_FILE_NAME}`;

  const restore =
    manager === 'conda'
      ? `conda install --yes --file ${BACKUP_FILE_NAME}`
      : `python -m pip install -r ${BACKUP_FILE_NAME}`;

  const fromFile = buildFileCommand(manager, shell);

  return { backup, fromFile, inline, restore, chunked: chunks.length > 1 };
}

function buildFileCommand(manager: PackageManager, shell: Shell): string {
  switch (manager) {
    case 'uv':
      return `uv pip uninstall -r ${REMOVE_FILE_NAME}`;
    case 'conda':
      return `conda remove --yes --file ${REMOVE_FILE_NAME}`;
    case 'pipenv':
    case 'poetry': {
      // Neither manager reads a requirements file, so the list is expanded by
      // the shell. cmd has no command substitution, hence the loop.
      if (shell === 'cmd') {
        return `for /f "usebackq delims=" %i in ("${REMOVE_FILE_NAME}") do ${uninstallPrefix(
          manager,
        )} %i`;
      }
      const expansion =
        shell === 'powershell'
          ? `(Get-Content ${REMOVE_FILE_NAME})`
          : `$(cat ${REMOVE_FILE_NAME})`;
      return `${uninstallPrefix(manager)} ${expansion}`;
    }
    case 'pip':
    default:
      return `python -m pip uninstall --yes -r ${REMOVE_FILE_NAME}`;
  }
}

/** The whole procedure as one copyable script, comments included. */
export function renderScript(plan: CommandPlan, shell: Shell): string {
  const comment = shell === 'cmd' ? 'REM' : '#';
  const lines = [
    `${comment} 1. Record the current environment so it can be restored.`,
    plan.backup,
    '',
    `${comment} 2. Remove the reviewed packages.`,
    `${comment}    Save the package list as ${REMOVE_FILE_NAME} next to this script.`,
    plan.fromFile,
    '',
    `${comment} 3. If anything breaks, restore with:`,
    `${comment} ${plan.restore}`,
  ];
  return lines.join('\n');
}
