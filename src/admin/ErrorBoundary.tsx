import React, { ReactNode } from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#fff1f1', color: '#900', minHeight: '100vh' }}>
          <h2>🚨 React Error</h2>
          <p><strong>{error.message}</strong></p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, overflowX: 'auto' }}>{error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
