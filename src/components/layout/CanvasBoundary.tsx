import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; label: string }
type State = { message: string | null }

export class CanvasBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: Error): State {
    return { message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(this.props.label, error, info)
  }

  render() {
    if (this.state.message) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
          {this.props.label} could not start WebGL. {this.state.message}
        </div>
      )
    }
    return this.props.children
  }
}
