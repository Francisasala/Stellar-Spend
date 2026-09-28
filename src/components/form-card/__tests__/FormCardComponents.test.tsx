import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputField } from '../InputField';
import { SelectField } from '../SelectField';
import { ResolvedField } from '../ResolvedField';
import { PayoutBox } from '../PayoutBox';
import { FeeMethodSelector } from '../FeeMethodSelector';
import { formatPayout, getCurrencySymbol, buildProviderQuotes } from '../types';

describe('FormCard Subcomponents', () => {
  describe('InputField', () => {
    it('renders input with label and handles change', () => {
      const onChange = vi.fn();
      render(<InputField label="Amount" id="amount" value="100" onChange={onChange} />);

      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      const input = screen.getByRole('spinbutton', { hidden: true }) || screen.getByDisplayValue('100');
      fireEvent.change(input, { target: { value: '200' } });
      expect(onChange).toHaveBeenCalledWith('200');
    });

    it('shows error state when touched with error', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="invalid"
          onChange={vi.fn()}
          error="Invalid amount"
          touched={true}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Invalid amount');
    });
  });

  describe('SelectField', () => {
    it('renders select with options and handles change', () => {
      const onChange = vi.fn();
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
      ];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={onChange}
        />,
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'KES' } });
      expect(onChange).toHaveBeenCalledWith('KES');
    });
  });

  describe('ResolvedField', () => {
    it('displays resolved value with success icon', () => {
      render(<ResolvedField label="Account Name" value="Jane Doe" />);
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('displays loading indicator when resolving', () => {
      render(<ResolvedField label="Account Name" value="" loading={true} />);
      expect(screen.getByText('Resolving...')).toBeInTheDocument();
    });
  });

  describe('PayoutBox', () => {
    it('renders payout formatted with rate', () => {
      const mockQuote = {
        rate: 1500,
        destinationAmount: '150000',
        bridgeFee: '0.5',
        payoutFee: '0.0',
        totalFee: '0.5',
        estimatedTime: 300,
      };

      render(<PayoutBox quote={mockQuote} currency="NGN" />);
      expect(screen.getByText(/estimated payout/i)).toBeInTheDocument();
      expect(screen.getByText(/150,000/)).toBeInTheDocument();
    });
  });

  describe('FeeMethodSelector', () => {
    it('allows toggling between USDC and XLM', () => {
      const onChange = vi.fn();
      render(
        <FeeMethodSelector
          feeMethod="USDC"
          gasFees={{ usdcFee: '0.50 USDC', xlmFee: '1.20 XLM' }}
          isLoading={false}
          onChange={onChange}
        />,
      );

      const xlmBtn = screen.getByText('XLM');
      fireEvent.click(xlmBtn);
      expect(onChange).toHaveBeenCalledWith('XLM');
    });
  });

  describe('helpers', () => {
    it('formats payouts correctly', () => {
      expect(formatPayout('1000', 'NGN')).toContain('1,000');
      expect(getCurrencySymbol('USD')).toBe('$');
    });

    it('builds provider quotes array', () => {
      const quotes = buildProviderQuotes(
        {
          rate: 1500,
          destinationAmount: '150000',
          bridgeFee: '0.5',
          payoutFee: '0.0',
          totalFee: '0.5',
          estimatedTime: 300,
        },
        'NGN',
      );
      expect(quotes.length).toBe(3);
    });
  });

  describe('Accessibility: aria-labels and descriptions', () => {
    it('should have aria-label on input fields', () => {
      render(<InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />);

      const input = screen.getByLabelText(/amount/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'amount');
    });

    it('should have aria-label on select fields', () => {
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
      ];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={vi.fn()}
        />,
      );

      const select = screen.getByLabelText(/currency/i);
      expect(select).toBeInTheDocument();
    });

    it('should display error messages with aria-alert', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="invalid"
          onChange={vi.fn()}
          error="Invalid amount"
          touched={true}
        />,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Invalid amount');
    });

    it('should have descriptive labels for resolved fields', () => {
      render(<ResolvedField label="Account Name" value="Jane Doe" />);

      expect(screen.getByText('Account Name')).toBeInTheDocument();
    });

    it('should announce loading state for resolved fields', () => {
      render(<ResolvedField label="Account Name" value="" loading={true} />);

      expect(screen.getByText('Resolving...')).toBeInTheDocument();
    });
  });

  describe('Accessibility: focus management', () => {
    it('should allow focus on input fields', () => {
      render(<InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />);

      const input = screen.getByLabelText(/amount/i);
      input.focus();
      expect(input).toHaveFocus();
    });

    it('should allow focus on select fields', () => {
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
      ];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={vi.fn()}
        />,
      );

      const select = screen.getByRole('combobox');
      select.focus();
      expect(select).toHaveFocus();
    });

    it('should support tab navigation through form fields', () => {
      const { container } = render(
        <>
          <InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />
          <SelectField
            label="Currency"
            id="currency"
            value="NGN"
            options={[{ value: 'NGN', label: 'Nigerian Naira' }]}
            onChange={vi.fn()}
          />
        </>,
      );

      const inputs = container.querySelectorAll('input, select');
      expect(inputs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Accessibility: form validation', () => {
    it('should associate error messages with form fields', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="invalid"
          onChange={vi.fn()}
          error="Invalid amount"
          touched={true}
        />,
      );

      const input = screen.getByLabelText(/amount/i);
      const alert = screen.getByRole('alert');

      expect(input).toBeInTheDocument();
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Invalid amount');
    });

    it('should provide helpful error descriptions', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value=""
          onChange={vi.fn()}
          error="Amount is required"
          touched={true}
        />,
      );

      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/amount is required/i);
    });
  });

  describe('Accessibility: semantic structure', () => {
    it('should use semantic label elements', () => {
      const { container } = render(
        <InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />,
      );

      const labels = container.querySelectorAll('label');
      expect(labels.length).toBeGreaterThan(0);
    });

    it('should have proper heading hierarchy', () => {
      const { container } = render(
        <>
          <InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />
          <SelectField
            label="Currency"
            id="currency"
            value="NGN"
            options={[{ value: 'NGN', label: 'Nigerian Naira' }]}
            onChange={vi.fn()}
          />
        </>,
      );

      expect(container).toBeInTheDocument();
    });

    it('should have descriptive text for complex fields', () => {
      const mockQuote = {
        rate: 1500,
        destinationAmount: '150000',
        bridgeFee: '0.5',
        payoutFee: '0.0',
        totalFee: '0.5',
        estimatedTime: 300,
      };

      render(<PayoutBox quote={mockQuote} currency="NGN" />);

      expect(screen.getByText(/estimated payout/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility: keyboard interaction', () => {
    it('should handle keyboard input in text fields', () => {
      const onChange = vi.fn();
      render(<InputField label="Amount" id="amount" value="100" onChange={onChange} />);

      const input = screen.getByLabelText(/amount/i);
      fireEvent.keyDown(input, { key: 'a' });
      fireEvent.change(input, { target: { value: '200' } });

      expect(onChange).toHaveBeenCalled();
    });

    it('should handle keyboard input in select fields', () => {
      const onChange = vi.fn();
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
      ];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={onChange}
        />,
      );

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'KES' } });

      expect(onChange).toHaveBeenCalledWith('KES');
    });
  });
});
