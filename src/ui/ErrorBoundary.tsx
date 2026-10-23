import { Component, type ReactNode } from 'react'

/** Keeps a broken overlay from taking the whole game down; the 3D scene keeps running. */
export class ErrorBoundary extends Component<
  { children: ReactNode; name: string },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}]`, error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
