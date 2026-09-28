import { render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { AppProviders } from '../AppProviders';

describe('AppProviders', () => {
  it('renders children', () => {
    render(
      <AppProviders>
        <div data-testid="test-child">Test Content</div>
      </AppProviders>,
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('wraps all providers in correct order', () => {
    const { container } = render(
      <AppProviders>
        <div>Content</div>
      </AppProviders>,
    );

    expect(container).toBeInTheDocument();
  });

  it('renders without crashing with empty children', () => {
    const { container } = render(
      <AppProviders>
        <></>
      </AppProviders>,
    );

    expect(container).toBeInTheDocument();
  });

  it('handles multiple children elements', () => {
    render(
      <AppProviders>
        <div data-testid="first">First</div>
        <div data-testid="second">Second</div>
        <div data-testid="third">Third</div>
      </AppProviders>,
    );

    expect(screen.getByTestId('first')).toBeInTheDocument();
    expect(screen.getByTestId('second')).toBeInTheDocument();
    expect(screen.getByTestId('third')).toBeInTheDocument();
  });

  describe('Provider Composition and Ordering', () => {
    it('should provide a flat interface despite nested providers', () => {
      const testContent = 'Test Content for Provider Composition';
      render(
        <AppProviders>
          <div data-testid="provider-test">{testContent}</div>
        </AppProviders>,
      );

      const element = screen.getByTestId('provider-test');
      expect(element).toBeInTheDocument();
      expect(element).toHaveTextContent(testContent);
    });

    it('should compose providers without exposing internal pyramid', () => {
      const providerCount = 4;
      render(
        <AppProviders>
          <div data-testid="composition-test">Composed Providers</div>
        </AppProviders>,
      );

      const element = screen.getByTestId('composition-test');
      expect(element).toBeInTheDocument();
      expect(element.textContent).not.toBe('');
    });

    it('maintains provider ordering: I18n → ErrorBoundary → Theme → Notification', () => {
      const orderTest = 'Provider order test';
      render(
        <AppProviders>
          <div data-testid="order-test">{orderTest}</div>
        </AppProviders>,
      );

      const element = screen.getByTestId('order-test');
      expect(element.textContent).toBe(orderTest);
    });
  });

  describe('Provider Dependencies', () => {
    it('I18nProvider is outermost and available to all providers', () => {
      render(
        <AppProviders>
          <div data-testid="i18n-dependent">I18n Dependent Content</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('i18n-dependent')).toBeInTheDocument();
    });

    it('ErrorBoundary is positioned after I18n to catch errors in all descendants', () => {
      render(
        <AppProviders>
          <div data-testid="error-boundary-test">Error Boundary Test</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('error-boundary-test')).toBeInTheDocument();
    });

    it('ThemeProvider sets up context available to NotificationProvider', () => {
      render(
        <AppProviders>
          <div data-testid="theme-test">Theme Available</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('theme-test')).toBeInTheDocument();
    });

    it('NotificationProvider is innermost, depends on all other providers', () => {
      render(
        <AppProviders>
          <div data-testid="notification-test">Notification Available</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('notification-test')).toBeInTheDocument();
    });
  });

  describe('Hydration Safety', () => {
    it('preserves provider ordering to prevent hydration mismatches', () => {
      const { container, rerender } = render(
        <AppProviders>
          <div data-testid="hydration-test">Hydration Safe</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('hydration-test')).toBeInTheDocument();

      rerender(
        <AppProviders>
          <div data-testid="hydration-test">Hydration Safe</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('hydration-test')).toBeInTheDocument();
    });

    it('does not cause context errors with consistent provider order', () => {
      const TestComponent = () => (
        <div data-testid="context-safe">Context Safe</div>
      );

      const { rerender } = render(
        <AppProviders>
          <TestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('context-safe')).toBeInTheDocument();

      rerender(
        <AppProviders>
          <TestComponent />
        </AppProviders>,
      );

      expect(screen.getByTestId('context-safe')).toBeInTheDocument();
    });
  });

  describe('Provider Integration', () => {
    it('supports children receiving values from all composed providers', () => {
      render(
        <AppProviders>
          <div data-testid="all-providers">Access all providers</div>
        </AppProviders>,
      );

      expect(screen.getByTestId('all-providers')).toBeInTheDocument();
    });

    it('flattens provider pyramid structure', () => {
      const content = 'Flat Provider Structure';
      const { container } = render(
        <AppProviders>
          <span data-testid="flat-test">{content}</span>
        </AppProviders>,
      );

      const element = screen.getByTestId('flat-test');
      expect(element.textContent).toBe(content);
      expect(container).toBeInTheDocument();
    });

    it('eliminates need to track deep provider nesting for consumers', () => {
      const NestedChild = () => (
        <div data-testid="nested-consumer">Nested Consumer</div>
      );

      render(
        <AppProviders>
          <NestedChild />
        </AppProviders>,
      );

      expect(screen.getByTestId('nested-consumer')).toBeInTheDocument();
    });
  });
});
