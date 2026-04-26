import React, { Component, ErrorInfo, ReactNode } from 'react';
import { C } from '../theme';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console for debugging
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-8" style={{ background: C.bg, color: C.text }}>
          <div className="w-full max-w-4xl rounded-xl p-8" style={{ background: C.elevated }}>
            <h1 className="mb-4 text-3xl font-bold" style={{ color: C.red }}>Something went wrong.</h1>

            {this.state.error && (
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold" style={{ color: C.text }}>Error Message:</h2>
                <pre className="rounded-lg p-4 text-sm overflow-auto" style={{ background: C.bg, color: C.red }}>
                  {this.state.error.message}
                </pre>
              </div>
            )}

            {this.state.errorInfo && (
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold" style={{ color: C.text }}>Component Stack:</h2>
                <pre className="rounded-lg p-4 text-xs overflow-auto max-h-96" style={{ background: C.bg, color: C.textDim }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            {this.state.error && (
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold" style={{ color: C.text }}>Stack Trace:</h2>
                <pre className="rounded-lg p-4 text-xs overflow-auto max-h-96" style={{ background: C.bg, color: C.textDim }}>
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              className="rounded-lg px-6 py-3 font-medium transition-colors"
              style={{ background: C.teal, color: C.white }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

