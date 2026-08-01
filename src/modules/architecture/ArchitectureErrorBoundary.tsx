import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ArchitectureErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Architecture canvas failed to render", error, info);
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
          <div className="text-base font-semibold text-foreground">
            Architecture could not start
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            The diagram canvas ran into an unexpected problem. Your other tabs are still available.
          </p>
          <button
            type="button"
            className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85"
            onClick={this.retry}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
