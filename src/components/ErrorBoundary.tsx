import React from 'react';
import { resetStoredPreferences, type StorageLike } from '../types/preferences';

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReload?: () => void;
  storage?: StorageLike | null;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Top-level React error boundary so unexpected render exceptions present
 * a clean recovery screen rather than a blank viewport.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application render error:', error, info.componentStack);
  }

  resetError = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleReload = (): void => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  handleResetAndReload = (): void => {
    resetStoredPreferences(this.props.storage);
    this.resetError();
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen w-full flex items-center justify-center p-6 bg-[#181817] text-[#F1EFEA]"
        >
          <div className="max-w-md w-full rounded-2xl bg-[#242321] border border-white/10 p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-lg font-extrabold tracking-tight">Something went wrong</h1>
              <p className="text-xs text-[#A9A69E] leading-relaxed">
                Crownline Chess encountered an unexpected error. You can reload the app safely without losing your saved games.
              </p>
            </div>
            {this.state.errorMessage && (
              <div className="rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-[11px] font-mono text-[#D8D4CB] break-words">
                {this.state.errorMessage}
              </div>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-2.5 px-4 rounded-lg bg-[#81B64C] hover:bg-[#91C65A] text-[#141413] text-xs font-extrabold transition-colors cursor-pointer"
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="py-2.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D8D4CB] transition-colors cursor-pointer"
              >
                Reset Preferences
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
