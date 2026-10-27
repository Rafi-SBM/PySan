import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Notice } from './Notice';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a malformed environment report cannot leave the
 * user looking at a blank page with no way forward.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('PySan encountered an unexpected error.', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  private handleHardReset = (): void => {
    try {
      window.localStorage.clear();
    } catch {
      // Nothing to clear.
    }
    window.location.reload();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <Notice tone="danger" title="Something went wrong">
          <p>
            PySan hit an unexpected error while rendering. Your data never left the
            browser, and nothing on your machine was changed.
          </p>
          <pre>{error.message}</pre>
        </Notice>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={this.handleReset}>
            Try again
          </button>
          <button type="button" className="btn" onClick={this.handleHardReset}>
            Clear saved data and reload
          </button>
        </div>
      </div>
    );
  }
}
