import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Keeps a telemetry rendering fault from unmounting the workspace app. */
export class ProviderUsageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Provider usage dashboard failed to render", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <span className="text-xs text-muted-foreground">
          Provider usage is temporarily unavailable.
        </span>
      );
    }
    return this.props.children;
  }
}
