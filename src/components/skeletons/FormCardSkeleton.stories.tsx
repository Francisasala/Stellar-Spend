import type { Meta, StoryObj } from '@storybook/react';
import { FormCardSkeleton } from './FormCardSkeleton';

const meta: Meta<typeof FormCardSkeleton> = {
  title: 'Design System/Skeletons/FormCardSkeleton',
  component: FormCardSkeleton,
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
type Story = StoryObj<typeof FormCardSkeleton>;

export const Default: Story = {};
