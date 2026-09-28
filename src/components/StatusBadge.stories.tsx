import type { Meta, StoryObj } from '@storybook/react';
import { StatusBadge } from './StatusBadge';

const meta: Meta<typeof StatusBadge> = {
  title: 'Design System/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    showIcon: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Pending: Story = {
  args: {
    status: 'pending',
  },
};

export const Processing: Story = {
  args: {
    status: 'processing',
  },
};

export const Success: Story = {
  args: {
    status: 'success',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
  },
};

export const Reversed: Story = {
  args: {
    status: 'reversed',
  },
};

export const WithoutIcon: Story = {
  args: {
    status: 'completed',
    showIcon: false,
  },
};

export const UnknownStatus: Story = {
  args: {
    // Intentionally not a configured status — exercises the fallback config.
    status: 'unmapped-status' as never,
  },
};
