import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within, expect } from '@storybook/test';
import { Input } from './Input';

const meta: Meta<typeof Input> = {
  title: 'UI Primitives/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error'],
    },
    inputSize: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter a value',
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    defaultValue: 'invalid@',
    placeholder: 'Enter your email',
  },
};

export const Small: Story = {
  args: {
    inputSize: 'sm',
    placeholder: 'Small',
  },
};

export const Large: Story = {
  args: {
    inputSize: 'lg',
    placeholder: 'Large',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Cannot edit this',
  },
};

export const Interactive: Story = {
  args: {
    placeholder: 'Type something...',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/type something/i);

    // Test focus interaction
    await userEvent.click(input);
    await expect(input).toHaveFocus();

    // Test typing
    await userEvent.type(input, 'Hello, Stellar!');
    await expect(input).toHaveValue('Hello, Stellar!');

    // Test blur
    await userEvent.tab();
    await expect(input).not.toHaveFocus();
  },
};

export const DisabledInteraction: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/disabled input/i);

    // Test that input is disabled
    await expect(input).toBeDisabled();

    // Try to type (should not work, but we can verify the state)
    await userEvent.click(input);
    await userEvent.type(input, 'Should not type');
    // Input should still be empty since it's disabled
    await expect(input).toHaveValue('');
  },
};

export const ErrorInteraction: Story = {
  args: {
    variant: 'error',
    placeholder: 'Enter your email',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/enter your email/i);

    // Error variant should still be editable
    await expect(input).not.toBeDisabled();
    await userEvent.type(input, 'invalid@');
    await expect(input).toHaveValue('invalid@');
  },
};
