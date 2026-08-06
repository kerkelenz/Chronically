import { Component } from "react";
import * as Sentry from "@sentry/react";

// App-wide safety net. If a render throws anywhere below it, we show a calm
// branded screen instead of a blank white page, and report the error to Sentry
// (a no-op without a DSN). Kept as a class because only class components can be
// error boundaries in React.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try {
      Sentry.captureException(error);
    } catch {
      // Sentry unavailable — never let reporting break the fallback
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-6"
        style={{
          background:
            "linear-gradient(160deg, #7C6BAE 0%, #9B8EC4 55%, #C4A8C0 100%)",
        }}
      >
        <div
          className="relative z-10 w-full max-w-sm flex flex-col items-center gap-4 p-7 rounded-2xl text-center backdrop-blur-md"
          style={{
            background: "rgba(255,255,255,0.22)",
            border: "1px solid rgba(255,255,255,0.4)",
          }}
        >
          <h1
            className="text-2xl font-medium text-white"
            style={{ fontFamily: "Playfair Display, Georgia, serif" }}
          >
            Something went wrong
          </h1>
          <p className="text-sm text-white/80">
            The page hit an unexpected error — reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-1 px-6 py-2 rounded-full bg-white font-medium text-sm hover:scale-105 transition-all duration-200"
            style={{ color: "#7C6BAE" }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
