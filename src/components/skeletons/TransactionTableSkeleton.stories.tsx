import type { Meta, StoryObj } from '@storybook/react';
import { TransactionTableSkeleton } from './TransactionTableSkeleton';

const meta: Meta<typeof TransactionTableSkeleton> = {
  title: 'Design System/Skeletons/TransactionTableSkeleton',
  component: TransactionTableSkeleton,
  tags: ['autodocs'],
  argTypes: {
    rows: {
      control: 'number',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TransactionTableSkeleton>;

export const Default: Story = {
  args: {
    rows: 3,
  },
};

export const SingleRow: Story = {
  args: {
    rows: 1,
  },
};

export const ManyRows: Story = {
  args: {
    rows: 8,
  },
};
