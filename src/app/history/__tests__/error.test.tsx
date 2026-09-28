import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import HistoryError from '../error';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('History Error Boundary', () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays history error title', () => {
    const error = new Error('History not found');
    render(<HistoryError error={error} reset={mockReset} />);

    expect(screen.getByText('Transaction History Error')).toBeInTheDocument();
  });

  it('displays error message', () => {
    const error = new Error('Failed to load transactions');
    render(<HistoryError error={error} reset={mockReset} />);

    expect(screen.getByText('Failed to load transactions')).toBeInTheDocument();
  });

  it('calls reset on try again button click', () => {
    const error = new Error('History error');
    render(<HistoryError error={error} reset={mockReset} />);

    const tryAgainButton = screen.getByText('Try again');
    fireEvent.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders navigation link', () => {
    const error = new Error('History error');
    render(<HistoryError error={error} reset={mockReset} />);

    expect(screen.getByText('Go home')).toBeInTheDocument();
  });

  it('reports the error to Sentry', () => {
    const error = new Error('History error');
    render(<HistoryError error={error} reset={mockReset} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('History error');

    render(<HistoryError error={error} reset={mockReset} />);

    expect(consoleSpy).toHaveBeenCalledWith('History error:', error);
    consoleSpy.mockRestore();
  });
});
