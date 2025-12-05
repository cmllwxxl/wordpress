'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
        if (this.props.fallback) {
            return this.props.fallback;
        }
        
        return (
            <div className="p-6 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-center">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">组件出现错误</h3>
                <p className="text-red-700 dark:text-red-300 mb-4 max-w-md mx-auto text-sm">
                    {this.state.error?.message || '发生未知错误'}
                </p>
                <button
                    onClick={() => {
                        this.setState({ hasError: false, error: null });
                        window.location.reload();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4" />
                    重试
                </button>
            </div>
        );
    }

    return this.props.children;
  }
}
