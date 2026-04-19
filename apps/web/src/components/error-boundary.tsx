"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type State = { error: Error | null };

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: (err: Error, reset: () => void) => ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error boundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50">
          <div className="max-w-lg w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Something broke</h2>
            <p className="text-sm text-slate-500">
              An unexpected error crashed this screen. You can retry — if it happens again, please grab the message below and report it.
            </p>
            <pre className="text-xs bg-slate-50 border border-slate-200 rounded-md p-3 overflow-auto max-h-48">
              {this.state.error.message}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={() => location.reload()}>Reload</Button>
              <Button variant="primary" size="md" onClick={this.reset}>Try again</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
