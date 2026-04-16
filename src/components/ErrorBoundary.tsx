import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import i18next from 'i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing the entire app.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console (in production, you'd send this to error tracking service)
    console.error('Error caught by boundary:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // TODO: Send error to error tracking service (Sentry, LogRocket, etc.)
    // Example:
    // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="flex items-center justify-center min-h-[400px] p-4">
          <Card className="max-w-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <CardTitle>{i18next.t('errorBoundary.title', { ns: 'common' })}</CardTitle>
              </div>
              <CardDescription>
                {i18next.t('errorBoundary.description', { ns: 'common' })}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {this.state.error && (
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-[200px]">
                  <p className="font-mono text-sm text-destructive mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              {!this.state.error && (
                <p className="text-sm text-muted-foreground">
                  {i18next.t('errorBoundary.contactSupport', { ns: 'common' })}
                </p>
              )}
            </CardContent>

            <CardFooter className="flex gap-2">
              <Button onClick={this.handleReset} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                {i18next.t('errorBoundary.retry', { ns: 'common' })}
              </Button>
              <Button onClick={() => window.location.reload()} variant="default">
                {i18next.t('errorBoundary.refreshPage', { ns: 'common' })}
              </Button>
            </CardFooter>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Boundary for specific features (smaller fallback UI)
 */
export class FeatureErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Feature error:', error, errorInfo);

    this.setState({ errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="border border-destructive/50 rounded-lg p-4 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium">{i18next.t('errorBoundary.featureLoadError', { ns: 'common' })}</p>
              <Button onClick={this.handleReset} size="sm" variant="outline">
                {i18next.t('errorBoundary.retry', { ns: 'common' })}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
