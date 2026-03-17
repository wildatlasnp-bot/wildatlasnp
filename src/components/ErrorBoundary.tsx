import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="text-center max-w-xs w-full">
            <img
              src="/mochi-worried.png"
              alt="Mochi worried"
              className="w-24 h-24 object-contain mx-auto mb-5"
            />
            <h1 className="text-xl font-heading font-bold text-foreground mb-2">
              🐻 Trail hiccup
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Something unexpected happened. Mochi tripped over a root — but don't worry, a quick refresh should get you back on the trail.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-xl px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={16} />
              Refresh App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
