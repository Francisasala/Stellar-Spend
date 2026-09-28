import type { Meta, StoryObj } from '@storybook/react';
import { WalletConnectionSkeleton } from './WalletConnectionSkeleton';

const meta: Meta<typeof WalletConnectionSkeleton> = {
  title: 'Design System/Skeletons/WalletConnectionSkeleton',
  component: WalletConnectionSkeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WalletConnectionSkeleton>;

export const Default: Story = {};
