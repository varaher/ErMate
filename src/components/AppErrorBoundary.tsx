import React, { Component, ReactNode, ErrorInfo } from "react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, ErrorBoundaryState> {
  declare props: AppErrorBoundaryProps;
  declare state: ErrorBoundaryState;

  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[AppErrorBoundary] Caught render crash:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 px-6 text-center gap-4 text-slate-100 font-sans">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 text-xl font-bold">
            !
          </div>
          <p className="text-lg font-bold text-white">Something went wrong</p>
          <p className="text-sm text-slate-400 max-w-sm">
            {this.state.errorMessage || "An unexpected error occurred during state transition."}
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-all cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

