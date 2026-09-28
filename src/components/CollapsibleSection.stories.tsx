import type { Meta, StoryObj } from '@storybook/react';
import { CollapsibleSection } from './CollapsibleSection';

const meta: Meta<typeof CollapsibleSection> = {
  title: 'Design System/CollapsibleSection',
  component: CollapsibleSection,
  tags: ['autodocs'],
  argTypes: {
    defaultOpen: {
      control: 'boolean',
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
type Story = StoryObj<typeof CollapsibleSection>;

export const Collapsed: Story = {
  args: {
    id: 'advanced-options',
    title: 'Advanced options',
    description: 'Fee method, routing details, and more',
    defaultOpen: false,
    children: <p className="text-sm text-[#aaaaaa]">Hidden content goes here.</p>,
  },
};

export const Expanded: Story = {
  args: {
    id: 'advanced-options-open',
    title: 'Advanced options',
    description: 'Fee method, routing details, and more',
    defaultOpen: true,
    children: <p className="text-sm text-[#aaaaaa]">Visible content goes here.</p>,
  },
};

export const WithoutDescription: Story = {
  args: {
    id: 'no-description',
    title: 'Transaction details',
    defaultOpen: true,
    children: <p className="text-sm text-[#aaaaaa]">Content without a description line.</p>,
  },
};
