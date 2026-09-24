import React, { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center bg-white rounded-lg border border-[#fde7e9] shadow-2xs">
          <div className="p-3 bg-[#fde7e9] rounded-full text-[#d13438] mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-[#242424] mb-1">
            Something went wrong
          </h2>
          <p className="text-xs text-[#605e5c] max-w-md mb-4 font-mono bg-[#faf9f8] p-3 rounded border border-[#edebe9]">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f6cbd] text-white text-xs font-semibold rounded hover:bg-[#0f6cbd]/90 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
