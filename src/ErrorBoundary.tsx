import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  public handleReload = () => {
    localStorage.clear(); // Clear local storage to fix corrupted states
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070913] text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-[#0d0f1e] border border-[#ef4444]/30 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 text-[#ef4444]">
              <span className="text-4xl">⚠️</span>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Application Crash Intercepted</h1>
                <p className="text-xs text-neutral-400">An unexpected error occurred during rendering.</p>
              </div>
            </div>

            <div className="bg-[#05060b] border border-neutral-800 rounded-2xl p-4 overflow-x-auto text-left">
              <p className="text-brand-yellow font-extrabold text-xs uppercase mb-1">Error Message:</p>
              <code className="text-sm text-red-400 break-words font-mono">
                {this.state.error?.toString() || "Unknown rendering exception"}
              </code>
              {this.state.errorInfo && (
                <pre className="mt-4 text-[10px] text-neutral-400 font-mono overflow-auto max-h-40 leading-relaxed">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-gradient-to-r from-red-500 to-orange-500 text-black font-extrabold py-3.5 px-6 rounded-2xl hover:scale-[1.02] transform transition-transform cursor-pointer text-center text-sm"
              >
                Clear Cache & Reload Site
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-neutral-800 text-white font-extrabold py-3.5 px-6 rounded-2xl border border-neutral-700 hover:bg-neutral-700 transition-colors cursor-pointer text-center text-sm"
              >
                Simple Refresh
              </button>
            </div>

            <p className="text-[10px] text-center text-neutral-500">
              Tamil Nadu Bus Stop Registry Diagnostics
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
