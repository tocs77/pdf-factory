import React, { ErrorInfo, Suspense } from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null, showDetails: false };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }
  render() {
    if (this.state.error) {
      return (
        <Suspense>
          <div
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
            <h2>Произошла ошибка в приложении.</h2>
            <h3> Обновите страницу</h3>
            <button onClick={() => this.setState({ showDetails: !this.state.showDetails })} title='Технические детали' />
            {this.state.showDetails && (
              <div style={{ margin: '20px', width: '80%' }}>
                <h3>{this.state?.error?.message}</h3>
                {this.state?.errorInfo?.componentStack?.split('\n').map((s, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  <div key={i}>{s}</div>
                ))}
              </div>
            )}
          </div>
        </Suspense>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
