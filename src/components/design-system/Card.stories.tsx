import type { Meta, StoryObj } from '@storybook/react';
import { within, expect, userEvent } from '@storybook/test';
import { Card, CardHeader, CardContent, CardFooter } from './Card';
import React from 'react';

const meta: Meta<typeof Card> = {
  title: 'Design System/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'elevated', 'outlined'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    interactive: {
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    variant: 'default',
    children: 'This is a default card.',
  },
};

export const Elevated: Story = {
  args: {
    variant: 'elevated',
    children: 'This is an elevated card with shadow.',
  },
};

export const Outlined: Story = {
  args: {
    variant: 'outlined',
    children: 'This is an outlined card.',
  },
};

export const PaddingVariants: Story = {
  render: (args) => (
    <div className="space-y-4">
      <Card {...args} padding="none">
        <CardContent>No padding</CardContent>
      </Card>
      <Card {...args} padding="sm">
        <CardContent>Small padding</CardContent>
      </Card>
      <Card {...args} padding="md">
        <CardContent>Medium padding</CardContent>
      </Card>
      <Card {...args} padding="lg">
        <CardContent>Large padding</CardContent>
      </Card>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText(/no padding/i)).toBeInTheDocument();
    await expect(canvas.getByText(/small padding/i)).toBeInTheDocument();
    await expect(canvas.getByText(/medium padding/i)).toBeInTheDocument();
    await expect(canvas.getByText(/large padding/i)).toBeInTheDocument();
  },
};

export const InteractiveCard: Story = {
  args: {
    variant: 'elevated',
    interactive: true,
    children: 'Clickable interactive card.',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const card = canvas.getByText(/clickable interactive card/i);
    await expect(card).toBeInTheDocument();

    await userEvent.click(card);
    await expect(card).toBeInTheDocument();
  },
};

export const WithHeaderAndFooter: Story = {
  render: (args) => (
    <Card {...args}>
      <CardHeader>
        <h2 className="text-xl font-bold">Card Title</h2>
      </CardHeader>
      <CardContent>
        <p>This is the main content of the card. It can contain any elements.</p>
      </CardContent>
      <CardFooter>
        <div className="flex justify-end gap-2">
          <button className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Submit
          </button>
        </div>
      </CardFooter>
    </Card>
  ),
};

export const WithButtons: Story = {
  render: (args) => (
    <Card {...args} variant="elevated">
      <CardHeader>
        <h3 className="text-lg font-semibold">Confirmation</h3>
      </CardHeader>
      <CardContent>
        <p className="text-gray-600">Are you sure you want to proceed?</p>
      </CardContent>
      <CardFooter>
        <div className="flex justify-end gap-2 w-full">
          <button className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">
            Cancel
          </button>
          <button className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Confirm
          </button>
        </div>
      </CardFooter>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test all card parts
    const header = canvas.getByText(/confirmation/i);
    const content = canvas.getByText(/are you sure/i);
    const cancelBtn = canvas.getByRole('button', { name: /cancel/i });
    const confirmBtn = canvas.getByRole('button', { name: /confirm/i });

    await expect(header).toBeInTheDocument();
    await expect(content).toBeInTheDocument();
    await expect(cancelBtn).toBeInTheDocument();
    await expect(confirmBtn).toBeInTheDocument();

    // Test button interactions
    await userEvent.click(confirmBtn);
    await expect(confirmBtn).toBeInTheDocument();
  },
};
