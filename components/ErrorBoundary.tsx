import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md p-8 bg-card rounded-lg shadow-lg text-center border border-border">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Đã xảy ra lỗi</h1>
            <p className="text-muted-foreground mb-6">Ứng dụng gặp sự cố. Vui lòng thử lại.</p>
            <div className="flex justify-center gap-4">
              <button
                // @ts-ignore
                onClick={() => this.setState({ hasError: false, error: null })}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90"
              >
                Thử lại
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-muted rounded-lg hover:opacity-90"
              >
                Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}