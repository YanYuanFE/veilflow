import { Component, type ErrorInfo, type ReactNode } from "react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}
interface State {
  error: Error | null
}

// Catches render-time throws so one bad input can't blank the whole SPA. Mounted at
// the top (main.tsx), per-page (layout Outlet, keyed on pathname so navigation resets
// it), and around the standalone claim page.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return this.props.fallback ?? <ErrorFallback message={this.state.error.message} />
  }
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-[0.6875rem] tracking-[0.2em] text-muted-foreground uppercase">Something broke</p>
      <h1 className="font-display text-3xl text-foreground">This page hit an unexpected error</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-sm border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/40"
      >
        Reload
      </button>
    </div>
  )
}
