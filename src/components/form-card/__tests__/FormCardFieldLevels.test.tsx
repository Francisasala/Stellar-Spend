import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InputField } from '../InputField';
import { SelectField } from '../SelectField';
import { ResolvedField } from '../ResolvedField';

describe('FormCard Field-Level Components', () => {
  describe('InputField - Modular Field Component', () => {
    it('renders input field with all props correctly', () => {
      const onChange = vi.fn();
      render(
        <InputField
          label="Recipient Address"
          id="address"
          value="0x123..."
          onChange={onChange}
          placeholder="Enter address"
        />,
      );

      expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter address')).toBeInTheDocument();
    });

    it('should handle input change events independently', () => {
      const onChange = vi.fn();
      render(<InputField label="Amount" id="amount" value="100" onChange={onChange} />);

      const input = screen.getByDisplayValue('100');
      fireEvent.change(input, { target: { value: '200' } });

      expect(onChange).toHaveBeenCalledWith('200');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should display error state only when touched', () => {
      const { rerender } = render(
        <InputField
          label="Amount"
          id="amount"
          value="invalid"
          onChange={vi.fn()}
          error="Invalid amount"
          touched={false}
        />,
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();

      rerender(
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

    it('should display success state when value is valid and touched', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="100"
          onChange={vi.fn()}
          success="Valid amount"
          touched={true}
        />,
      );

      expect(screen.getByText('Valid amount')).toBeInTheDocument();
    });

    it('should show help text when provided', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value=""
          onChange={vi.fn()}
          help="Enter amount in local currency"
        />,
      );

      expect(screen.getByText('Enter amount in local currency')).toBeInTheDocument();
    });

    it('should display suffix in input field', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="100"
          onChange={vi.fn()}
          suffix="NGN"
        />,
      );

      expect(screen.getByText('NGN')).toBeInTheDocument();
    });

    it('should handle disabled state', () => {
      const onChange = vi.fn();
      render(
        <InputField
          label="Amount"
          id="amount"
          value="100"
          onChange={onChange}
          disabled={true}
        />,
      );

      const input = screen.getByDisplayValue('100') as HTMLInputElement;
      expect(input.disabled).toBe(true);

      fireEvent.change(input, { target: { value: '200' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should handle different input modes', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="100"
          onChange={vi.fn()}
          inputMode="decimal"
        />,
      );

      const input = screen.getByDisplayValue('100') as HTMLInputElement;
      expect(input.inputMode).toBe('decimal');
    });

    it('should call onBlur callback', () => {
      const onBlur = vi.fn();
      render(
        <InputField label="Amount" id="amount" value="100" onChange={vi.fn()} onBlur={onBlur} />,
      );

      const input = screen.getByDisplayValue('100');
      fireEvent.blur(input);

      expect(onBlur).toHaveBeenCalled();
    });

    it('should show validating state', () => {
      render(
        <InputField
          label="Email"
          id="email"
          value="test@example.com"
          onChange={vi.fn()}
          validating={true}
        />,
      );

      expect(screen.getByLabelText('Validating…')).toBeInTheDocument();
    });

    it('should handle numeric type input', () => {
      render(
        <InputField
          label="Amount"
          id="amount"
          value="100"
          onChange={vi.fn()}
          type="number"
        />,
      );

      const input = screen.getByDisplayValue('100') as HTMLInputElement;
      expect(input.type).toBe('number');
    });
  });

  describe('SelectField - Modular Select Component', () => {
    it('renders select field with options', () => {
      const onChange = vi.fn();
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
        { value: 'UGX', label: 'Ugandan Shilling' },
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

      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('NGN');
    });

    it('should handle option change independently', () => {
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

    it('should display all available options', () => {
      const options = [
        { value: 'USD', label: 'US Dollar' },
        { value: 'EUR', label: 'Euro' },
        { value: 'GBP', label: 'British Pound' },
      ];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="USD"
          options={options}
          onChange={vi.fn()}
        />,
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.options.length).toBe(options.length);
    });

    it('should support disabled state', () => {
      const onChange = vi.fn();
      const options = [{ value: 'NGN', label: 'Nigerian Naira' }];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={onChange}
          disabled={true}
        />,
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.disabled).toBe(true);

      fireEvent.change(select, { target: { value: 'KES' } });
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should display error state when provided', () => {
      const options = [{ value: 'NGN', label: 'Nigerian Naira' }];

      render(
        <SelectField
          label="Currency"
          id="currency"
          value=""
          options={options}
          onChange={vi.fn()}
          error="Currency is required"
          touched={true}
        />,
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Currency is required');
    });

    it('should maintain selected value across re-renders', () => {
      const options = [
        { value: 'NGN', label: 'Nigerian Naira' },
        { value: 'KES', label: 'Kenyan Shilling' },
      ];

      const { rerender } = render(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={vi.fn()}
        />,
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('NGN');

      rerender(
        <SelectField
          label="Currency"
          id="currency"
          value="NGN"
          options={options}
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByRole('combobox')).toHaveValue('NGN');
    });
  });

  describe('ResolvedField - Modular Display Component', () => {
    it('renders resolved value display field', () => {
      render(<ResolvedField label="Account Name" value="Jane Doe" />);

      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should display loading state independently', () => {
      render(<ResolvedField label="Account Name" value="" loading={true} />);

      expect(screen.getByText('Resolving...')).toBeInTheDocument();
    });

    it('should transition from loading to resolved value', () => {
      const { rerender } = render(
        <ResolvedField label="Account Name" value="" loading={true} />,
      );

      expect(screen.getByText('Resolving...')).toBeInTheDocument();

      rerender(<ResolvedField label="Account Name" value="Jane Doe" loading={false} />);

      expect(screen.queryByText('Resolving...')).not.toBeInTheDocument();
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('should display success icon for resolved values', () => {
      render(<ResolvedField label="Account Name" value="Jane Doe" />);

      const successIcon = document.querySelector('[class*="text-green"]');
      expect(successIcon).toBeInTheDocument();
    });

    it('should handle empty resolved value', () => {
      render(<ResolvedField label="Account Name" value="" />);

      expect(screen.getByLabelText(/account name/i)).toBeInTheDocument();
    });

    it('should display error state if provided', () => {
      render(<ResolvedField label="Account Name" value="" error="Account not found" />);

      expect(screen.getByText('Account not found')).toBeInTheDocument();
    });
  });

  describe('Field Components - Independent Composition', () => {
    it('should render multiple field components without interference', () => {
      render(
        <>
          <InputField label="Amount" id="amount" value="100" onChange={vi.fn()} />
          <SelectField
            label="Currency"
            id="currency"
            value="NGN"
            options={[{ value: 'NGN', label: 'Nigerian Naira' }]}
            onChange={vi.fn()}
          />
          <ResolvedField label="Account" value="Jane Doe" />
        </>,
      );

      expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/account/i)).toBeInTheDocument();
    });

    it('should allow independent state management for each field', () => {
      const onAmountChange = vi.fn();
      const onCurrencyChange = vi.fn();

      render(
        <>
          <InputField
            label="Amount"
            id="amount"
            value="100"
            onChange={onAmountChange}
          />
          <SelectField
            label="Currency"
            id="currency"
            value="NGN"
            options={[{ value: 'NGN', label: 'Nigerian Naira' }]}
            onChange={onCurrencyChange}
          />
        </>,
      );

      const input = screen.getByDisplayValue('100');
      fireEvent.change(input, { target: { value: '200' } });

      expect(onAmountChange).toHaveBeenCalledWith('200');
      expect(onCurrencyChange).not.toHaveBeenCalled();
    });
  });
});
