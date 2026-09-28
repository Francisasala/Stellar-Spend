import type { Meta, StoryObj } from '@storybook/react';
import { Label } from './Label';

const meta: Meta<typeof Label> = {
  title: 'UI Primitives/Label',
  component: Label,
  tags: ['autodocs'],
  args: {
    children: 'Amount',
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {};

export const ForInput: Story = {
  args: {
    htmlFor: 'amount-input',
    children: 'Currency',
  },
};

export const LongText: Story = {
  args: {
    children: 'Beneficiary account identifier',
  },
};
