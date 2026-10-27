import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const REPORT = JSON.stringify({
  schema: 'pysan/collector/v2',
  python: { version: '3.12.1', platform: 'linux', prefix: '/opt/venv' },
  packages: [
    {
      name: 'pandas',
      version: '2.2.1',
      size: 50_000_000,
      requires: ['numpy>=1.23', 'obscure-helper>=1'],
    },
    { name: 'numpy', version: '1.26.4', size: 30_000_000, requires: [] },
    // In no profile, so it is kept only because pandas requires it.
    { name: 'obscure-helper', version: '1.2.0', size: 400_000, requires: [] },
    { name: 'pygame', version: '2.5.2', size: 12_000_000, requires: [] },
    { name: 'pip', version: '24.0', size: 5_000_000, requires: [] },
  ],
});

describe('PySan end to end', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function loadReport() {
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByLabelText(/paste the report contents/i);
    // `paste` avoids typing 400 characters one keystroke at a time.
    await user.click(textarea);
    await user.paste(REPORT);

    return user;
  }

  it('walks from import through to cleanup commands', async () => {
    const user = await loadReport();

    expect(await screen.findByText(/collector report loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/5 packages found/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /choose profiles/i }));

    await user.click(screen.getByRole('checkbox', { name: /data science/i }));
    await user.click(screen.getByRole('button', { name: /analyze 5 packages/i }));

    // numpy matches no profile but is required by pandas, so it stays.
    const table = screen.getByRole('table');
    const helperRow = within(table).getByRole('row', { name: /obscure-helper/i });
    expect(within(helperRow).getByText(/required by pandas/i)).toBeInTheDocument();

    // pygame is the only genuine candidate; pip is protected.
    expect(screen.getByText(/1 package flagged/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /get the cleanup commands/i }));

    expect(
      await screen.findByText(/python -m pip uninstall --yes -r pysan-remove\.txt/),
    ).toBeInTheDocument();
    expect(screen.getByText(/python -m pip freeze > requirements\.backup\.txt/)).toBeInTheDocument();
  });

  it('reports a parse failure without losing the pasted text', async () => {
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByLabelText(/paste the report contents/i);
    await user.click(textarea);
    await user.paste('{ broken json');

    expect(await screen.findByText(/could not be read/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose profiles/i })).toBeDisabled();
    expect(textarea).toHaveValue('{ broken json');
  });

  it('lets the user override a decision and keeps the counts in step', async () => {
    const user = await loadReport();

    await user.click(screen.getByRole('button', { name: /choose profiles/i }));
    await user.click(screen.getByRole('checkbox', { name: /data science/i }));
    await user.click(screen.getByRole('button', { name: /analyze 5 packages/i }));

    const table = screen.getByRole('table');
    // Anchored, because other rows mention pandas as the package that needs them.
    const pandasRow = within(table).getByRole('row', { name: /^pandas 2\.2\.1/ });
    await user.click(within(pandasRow).getByRole('button', { name: /^remove$/i }));

    // Removing pandas orphans numpy, so both become candidates.
    expect(await screen.findByText(/3 packages flagged/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset 1 manual change/i })).toBeInTheDocument();
  });

  it('refuses to flag protected packaging tooling', async () => {
    const user = await loadReport();

    await user.click(screen.getByRole('button', { name: /choose profiles/i }));
    await user.click(screen.getByRole('button', { name: /^clear$/i }));
    await user.click(screen.getByRole('checkbox', { name: /game development/i }));
    await user.click(screen.getByRole('button', { name: /analyze 5 packages/i }));

    const table = screen.getByRole('table');
    const pipRow = within(table).getByRole('row', { name: /\bpip\b/i });
    expect(within(pipRow).getByText(/locked/i)).toBeInTheDocument();
  });

  it('toggles the theme on the document element', async () => {
    const user = userEvent.setup();
    render(<App />);

    const initial = document.documentElement.dataset.theme;
    await user.click(screen.getByRole('button', { name: /switch to .* theme/i }));
    expect(document.documentElement.dataset.theme).not.toBe(initial);
  });
});
