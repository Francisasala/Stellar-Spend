import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as Sentry from '@sentry/nextjs';
import SettingsError from '../error';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

describe('Settings Error Boundary', () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays settings error title', () => {
    const error = new Error('Settings not found');
    render(<SettingsError error={error} reset={mockReset} />);

    expect(screen.getByText('Settings Error')).toBeInTheDocument();
  });

  it('displays error message', () => {
    const error = new Error('Failed to load user preferences');
    render(<SettingsError error={error} reset={mockReset} />);

    expect(screen.getByText('Failed to load user preferences')).toBeInTheDocument();
  });

  it('calls reset on try again button click', () => {
    const error = new Error('Settings error');
    render(<SettingsError error={error} reset={mockReset} />);

    const tryAgainButton = screen.getByText('Try again');
    fireEvent.click(tryAgainButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it('renders navigation links', () => {
    const error = new Error('Settings error');
    render(<SettingsError error={error} reset={mockReset} />);

    expect(screen.getByText('Go home')).toBeInTheDocument();
  });

  it('reports the error to Sentry', () => {
    const error = new Error('Settings error');
    render(<SettingsError error={error} reset={mockReset} />);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it('logs error to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Settings error');

    render(<SettingsError error={error} reset={mockReset} />);

    expect(consoleSpy).toHaveBeenCalledWith('Settings error:', error);
    consoleSpy.mockRestore();
  });
});
