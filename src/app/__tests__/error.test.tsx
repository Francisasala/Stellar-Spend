import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import Error from '../error';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('Root Error Boundary', () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays error page with title', () => {
    const error = new Error('Test error');
    render(<Error error={error} reset={mockReset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('displays error message', () => {
    const error = new Error('Network connection failed');
    render(<Error error={error} reset={mockReset} />);

    expect(screen.getByText('Network connection failed')).toBeInTheDocument();
  });

  it('displays error digest when available', () => {
    const error = new Error('Test error') as Error & { digest?: string };
    error.digest = 'abc123digest';
    render(<Error error={error} reset={mockReset} />);

    expect(screen.getByText(/Error ID: abc123digest/)).toBeInTheDocument();
  });

  it('calls reset callback when try again button clicked', () => {
    const error = new Error('Test error');
    render(<Error error={error} reset={mockReset} />);

    const tryAgainButton = screen.getByText('Try again');
    fireEvent.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders go home button', () => {
    const error = new Error('Test error');
    render(<Error error={error} reset={mockReset} />);

    const homeButton = screen.getByText('Go home');
    expect(homeButton).toBeInTheDocument();
  });

  it('reports the error to Sentry', () => {
    const error = new Error('Test error');
    render(<Error error={error} reset={mockReset} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');

    render(<Error error={error} reset={mockReset} />);

    expect(consoleSpy).toHaveBeenCalledWith('Root error:', error);
    consoleSpy.mockRestore();
  });
});
