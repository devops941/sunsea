import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

// One-shot session flag so we don't reload-loop if the reload itself fails.
const RELOAD_GUARD_KEY = "sunsea:chunk-reload-attempt";

// True for the class of errors Vite / bundlers throw when a lazy chunk's hash
// no longer exists on the server (dev server restart, prod deploy, etc.).
// The right response is a one-shot page reload to fetch the new bundle.
function isChunkLoadError(err: unknown): boolean {
  const msg = (err as any)?.message || String(err || "");
  return (
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Loading CSS chunk /i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    (err as any)?.name === "ChunkLoadError"
  );
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] React tree crashed:", error, info);

    if (isChunkLoadError(error)) {
      try {
        const alreadyTried = sessionStorage.getItem(RELOAD_GUARD_KEY);
        if (!alreadyTried) {
          sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
          window.location.reload();
          return;
        }
      } catch {
        window.location.reload();
        return;
      }
    }
  }

  reset = () => {
    try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch {}
    this.setState({ error: null });
  };

  reload = () => {
    try { sessionStorage.removeItem(RELOAD_GUARD_KEY); } catch {}
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunkError = isChunkLoadError(error);

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100 p-6">
        <div className="max-w-md w-full bg-slate-800/80 border border-slate-700 rounded-xl p-6 shadow-xl">
          <h1 className="text-lg font-bold text-rose-400 mb-2">
            {chunkError ? "App update detected" : "Something went wrong"}
          </h1>
          <p className="text-sm text-slate-300 mb-4">
            {chunkError
              ? "A newer version of the app is available. Reloading will pick it up."
              : "An unexpected error occurred. Reloading usually fixes it."}
          </p>
          <details className="mb-4 text-xs text-slate-400">
            <summary className="cursor-pointer select-none">Error details</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words bg-slate-900/60 p-2 rounded border border-slate-700">
              {error.message || String(error)}
            </pre>
          </details>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={this.reload}
              className="px-4 py-2 rounded-md bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm"
            >
              Reload page
            </button>
            {!chunkError && (
              <button
                type="button"
                onClick={this.reset}
                className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-white font-semibold text-sm"
              >
                Try again
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
