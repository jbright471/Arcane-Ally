import { Component, type ReactNode } from 'react';
import { Button } from './ui/button';

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <section role="alert" className="space-y-4 p-6">
      <h1 className="text-xl font-display">This view could not be displayed</h1>
      <p>Your navigation is still available. Try opening this view again.</p>
      <Button onClick={() => this.setState({ failed: false })}>Try again</Button>
    </section> : this.props.children;
  }
}
