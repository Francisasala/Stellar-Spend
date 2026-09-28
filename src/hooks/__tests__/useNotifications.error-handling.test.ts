import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNotifications } from '../useNotifications';
import * as notificationsLib from '@/lib/notifications';
import { logger } from '@/lib/logger';

vi.mock('@/lib/notifications');
vi.mock('@/lib/logger');

describe('useNotifications - Error Handling & Cleanup', () => {
  const mockNotificationPreferences = {
    userAddress: 'GB1234',
    emailEnabled: true,
    pushEnabled: true,
    smsEnabled: false,
  };

  const mockDeliveryRecord = {
    id: 'delivery-1',
    transactionId: 'tx-1',
    channel: 'email',
    status: 'delivered',
    createdAt: new Date().toISOString(),
    metadata: { read: false },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(notificationsLib.getOrCreateNotificationPreferences).mockResolvedValue(
      mockNotificationPreferences,
    );
    vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([]);
    vi.mocked(notificationsLib.upsertNotificationPreferences).mockResolvedValue(
      mockNotificationPreferences,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Preference Loading Error Handling', () => {
    it('should handle preference loading errors gracefully', async () => {
      const error = new Error('Failed to fetch preferences');
      vi.mocked(notificationsLib.getOrCreateNotificationPreferences).mockRejectedValue(error);

      const { result } = renderHook(() => useNotifications('GB1234'));

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch preferences');
      expect(result.current.preferences).toBeNull();
    });

    it('should handle non-Error exception in preferences loading', async () => {
      vi.mocked(notificationsLib.getOrCreateNotificationPreferences).mockRejectedValue(
        'Unexpected error',
      );

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load preferences');
    });

    it('should not load preferences when userAddress is null', async () => {
      const { result } = renderHook(() => useNotifications(null));

      expect(result.current.loading).toBe(true);
      expect(vi.mocked(notificationsLib.getOrCreateNotificationPreferences)).not.toHaveBeenCalled();
    });
  });

  describe('Delivery Loading Error Handling', () => {
    it('should handle delivery loading errors gracefully', async () => {
      const error = new Error('Failed to fetch deliveries');
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockRejectedValue(error);

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to fetch deliveries');
      expect(result.current.deliveries).toEqual([]);
    });

    it('should handle non-Error exception in delivery loading', async () => {
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockRejectedValue(
        'Delivery error',
      );

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Failed to load deliveries');
    });

    it('should load deliveries for specific transaction', async () => {
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([
        mockDeliveryRecord,
      ]);

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Manually call loadDeliveries for the test
      await act(async () => {
        await (result.current as any).loadDeliveries('tx-1');
      });

      await waitFor(() => {
        expect(result.current.deliveries).toHaveLength(1);
      });
    });
  });

  describe('Update Preferences Error Handling', () => {
    it('should handle preference update errors', async () => {
      const error = new Error('Update failed');
      vi.mocked(notificationsLib.upsertNotificationPreferences).mockRejectedValue(error);

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.updatePreferences({ emailEnabled: false });
        }),
      ).rejects.toThrow('Update failed');

      expect(result.current.error).toBe('Update failed');
    });

    it('should handle non-Error exception in preference update', async () => {
      vi.mocked(notificationsLib.upsertNotificationPreferences).mockRejectedValue('Unknown error');

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          try {
            await result.current.updatePreferences({ emailEnabled: false });
          } catch (e) {
            // Expected
          }
        }),
      ).resolves.toBeUndefined();

      expect(result.current.error).toBe('Failed to update preferences');
    });

    it('should not update preferences when userAddress is null', async () => {
      const { result } = renderHook(() => useNotifications(null));

      await act(async () => {
        await result.current.updatePreferences({ emailEnabled: false });
      });

      expect(vi.mocked(notificationsLib.upsertNotificationPreferences)).not.toHaveBeenCalled();
    });
  });

  describe('Unread Count Calculation', () => {
    it('should correctly calculate unread count from deliveries', async () => {
      const deliveries = [
        { ...mockDeliveryRecord, id: 'delivery-1', metadata: { read: false } },
        { ...mockDeliveryRecord, id: 'delivery-2', metadata: { read: true } },
        { ...mockDeliveryRecord, id: 'delivery-3', metadata: { read: false } },
      ];

      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue(
        deliveries,
      );

      const { result } = renderHook(() => useNotifications('GB1234'));

      await act(async () => {
        await (result.current as any).loadDeliveries();
      });

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(2);
      });
    });

    it('should update unread count when marking notification as read', async () => {
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([
        { ...mockDeliveryRecord, id: 'delivery-1', metadata: { read: false } },
      ]);

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(1);
      });

      act(() => {
        result.current.markAsRead('delivery-1');
      });

      expect(result.current.unreadCount).toBe(0);
    });

    it('should not go below zero when marking multiple as read', async () => {
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([
        { ...mockDeliveryRecord, id: 'delivery-1', metadata: { read: false } },
      ]);

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.unreadCount).toBe(1);
      });

      act(() => {
        result.current.markAsRead('delivery-1');
        result.current.markAsRead('delivery-1');
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });

  describe('Grouped Deliveries', () => {
    it('should group deliveries by date', async () => {
      const today = new Date().toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      const deliveries = [
        { ...mockDeliveryRecord, id: 'delivery-1', createdAt: new Date().toISOString() },
        { ...mockDeliveryRecord, id: 'delivery-2', createdAt: new Date().toISOString() },
        {
          ...mockDeliveryRecord,
          id: 'delivery-3',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ];

      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue(
        deliveries,
      );

      const { result } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.deliveries).toHaveLength(3);
      });

      const grouped = result.current.groupedDeliveries;
      expect(Object.keys(grouped)).toHaveLength(2);
      expect(grouped[today]).toHaveLength(2);
      expect(grouped[yesterday]).toHaveLength(1);
    });

    it('should handle empty deliveries in grouping', () => {
      const { result } = renderHook(() => useNotifications('GB1234'));

      const grouped = result.current.groupedDeliveries;
      expect(grouped).toEqual({});
    });
  });

  describe('Cleanup and Unmount', () => {
    it('should clear error state on successful reload', async () => {
      vi.mocked(notificationsLib.getOrCreateNotificationPreferences)
        .mockRejectedValueOnce(new Error('Initial error'))
        .mockResolvedValueOnce(mockNotificationPreferences);

      const { result, rerender } = renderHook(() => useNotifications('GB1234'));

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to load preferences');
      });

      vi.clearAllMocks();
      vi.mocked(notificationsLib.getOrCreateNotificationPreferences).mockResolvedValue(
        mockNotificationPreferences,
      );
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([]);

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle address change cleanup', async () => {
      const { rerender } = renderHook((address: string | null) => useNotifications(address), {
        initialProps: 'GB1234',
      });

      await waitFor(() => {
        expect(
          vi.mocked(notificationsLib.getOrCreateNotificationPreferences),
        ).toHaveBeenCalledWith('GB1234');
      });

      vi.clearAllMocks();
      vi.mocked(notificationsLib.getOrCreateNotificationPreferences).mockResolvedValue(
        mockNotificationPreferences,
      );
      vi.mocked(notificationsLib.getTransactionNotificationDeliveries).mockResolvedValue([]);

      rerender('GB5678');

      await waitFor(() => {
        expect(
          vi.mocked(notificationsLib.getOrCreateNotificationPreferences),
        ).toHaveBeenCalledWith('GB5678');
      });
    });
  });
});
