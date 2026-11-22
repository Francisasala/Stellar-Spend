import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI Primitives/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'text' },
    height: { control: 'text' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Text: Story = {
  args: {
    width: '200px',
    height: '20px',
  },
};

export const Circle: Story = {
  args: {
    width: '50px',
    height: '50px',
    className: 'rounded-full',
  },
};

export const LargeBlock: Story = {
  args: {
    width: '100%',
    height: '150px',
  },
};

export const Default: Story = {
  args: {},
};
