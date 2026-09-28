import type { Meta, StoryObj } from '@storybook/react';
import { BankAccountInputSkeleton } from './BankAccountInputSkeleton';

const meta: Meta<typeof BankAccountInputSkeleton> = {
  title: 'Design System/Skeletons/BankAccountInputSkeleton',
  component: BankAccountInputSkeleton,
  tags: ['autodocs'],
  argTypes: {
    fields: {
      control: 'select',
      options: [1, 2],
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof BankAccountInputSkeleton>;

export const SingleField: Story = {
  args: {
    fields: 1,
  },
};

export const TwoFields: Story = {
  args: {
    fields: 2,
  },
};
