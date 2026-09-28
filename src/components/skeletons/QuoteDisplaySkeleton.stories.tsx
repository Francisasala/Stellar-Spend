import type { Meta, StoryObj } from '@storybook/react';
import { QuoteDisplaySkeleton } from './QuoteDisplaySkeleton';

const meta: Meta<typeof QuoteDisplaySkeleton> = {
  title: 'Design System/Skeletons/QuoteDisplaySkeleton',
  component: QuoteDisplaySkeleton,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof QuoteDisplaySkeleton>;

export const Default: Story = {};
