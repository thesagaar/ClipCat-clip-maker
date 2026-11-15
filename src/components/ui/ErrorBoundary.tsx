import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, Home, RotateCw } from 'lucide-react';
import { captureSanitizedError } from '../../analytics/errorAdapter';
import { BRAND } from '../../config/brand';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureSanitizedError(error, {
      componentHint: info.componentStack ? 'react_error_boundary' : 'ui_boundary',
      eventType: 'application_error',
    });
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-ios-bg text-ios-label flex items-center justify-center p-4 sm:p-6">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl bg-ios-surface border border-[var(--ios-red-border)] p-6 sm:p-8 text-center space-y-5 shadow-2xl"
        >
          <div className="w-14 h-14 rounded-2xl bg-[var(--ios-red-tint)] border border-[var(--ios-red-border)] text-ios-red flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl font-extrabold text-ios-label">
              Something went wrong in {BRAND.productName}
            </h1>
            <p className="text-sm text-ios-secondary leading-relaxed">
              An unexpected interface error occurred. Your local project files remain safe on your machine.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-[#7040DC] hover:bg-[#5E32C4] text-white px-4 py-2 text-sm font-medium transition-colors cursor-pointer"
            >
              <RotateCw className="w-4 h-4" aria-hidden="true" />
              <span>Reload Studio</span>
            </button>
            <a
              href="/"
              onClick={() => this.setState({ hasError: false })}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-ios-tertiary hover:bg-ios-sep text-ios-label border border-ios-sep px-4 py-2 text-sm font-medium transition-colors"
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              <span>Return to Dashboard</span>
            </a>
          </div>
          <p className="text-[11px] text-ios-tertiary-label">
            {BRAND.productIdentity}
          </p>
        </div>
      </div>
    );
  }
}
