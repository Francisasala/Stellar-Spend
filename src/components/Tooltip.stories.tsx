import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Design System/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  argTypes: {
    position: {
      control: 'select',
      options: ['top', 'bottom', 'left', 'right'],
    },
    delay: {
      control: 'number',
    },
  },
  decorators: [
    (Story) => (
      <div className="flex items-center justify-center p-16">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  args: {
    content: 'Copy to clipboard',
    position: 'top',
    children: <button className="px-3 py-1.5 border border-line rounded">Hover me</button>,
  },
};

export const Bottom: Story = {
  args: {
    content: 'Copy to clipboard',
    position: 'bottom',
    children: <button className="px-3 py-1.5 border border-line rounded">Hover me</button>,
  },
};

export const Left: Story = {
  args: {
    content: 'Copy to clipboard',
    position: 'left',
    children: <button className="px-3 py-1.5 border border-line rounded">Hover me</button>,
  },
};

export const Right: Story = {
  args: {
    content: 'Copy to clipboard',
    position: 'right',
    children: <button className="px-3 py-1.5 border border-line rounded">Hover me</button>,
  },
};

export const NoDelay: Story = {
  args: {
    content: 'Appears instantly',
    delay: 0,
    children: <button className="px-3 py-1.5 border border-line rounded">Hover me</button>,
  },
};
