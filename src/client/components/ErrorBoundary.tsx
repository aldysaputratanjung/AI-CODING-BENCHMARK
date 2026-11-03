import { Component, type ReactNode } from "react";

interface State { hasError: boolean }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("UI error boundary:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-surface p-6">
          <div className="card max-w-md text-center">
            <h1 className="text-lg font-semibold text-slate-100">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-400">
              An unexpected error occurred. Please reload the page.
            </p>
            <button className="btn-primary mt-4" onClick={() => location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
