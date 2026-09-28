import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  DisputeStatus,
  DisputeReason,
  Dispute,
  CreateDisputeRequest,
  DisputeUpdate,
  DisputeAnalytics,
  DisputeNote,
  DisputeEscalation,
} from './disputes';

describe('Dispute types', () => {
  it('DisputeStatus includes all valid statuses', () => {
    const statuses: DisputeStatus[] = [
      'open',
      'in_review',
      'resolved',
      'rejected',
      'escalated',
    ];
    expect(statuses).toHaveLength(5);
  });

  it('DisputeReason includes all valid reasons', () => {
    const reasons: DisputeReason[] = [
      'unauthorized_transaction',
      'duplicate_charge',
      'incorrect_amount',
      'service_not_received',
      'other',
    ];
    expect(reasons).toHaveLength(5);
  });

  it('Dispute has all required fields', () => {
    const dispute: Dispute = {
      id: 'disp_001',
      transactionId: 'tx_001',
      userAddress: 'GBXXXX',
      reason: 'duplicate_charge',
      status: 'open',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(dispute.id).toBe('disp_001');
    expect(dispute.status).toBe('open');
  });

  it('Dispute accepts optional fields', () => {
    const dispute: Dispute = {
      id: 'disp_002',
      transactionId: 'tx_002',
      userAddress: 'GBYYYY',
      reason: 'incorrect_amount',
      description: 'Charged twice',
      status: 'escalated',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      resolvedAt: Date.now(),
      resolutionNotes: 'Refunded',
      assignedTo: 'admin_1',
      priority: 'high',
    };
    expect(dispute.description).toBe('Charged twice');
    expect(dispute.priority).toBe('high');
  });

  it('CreateDisputeRequest has required fields', () => {
    const req: CreateDisputeRequest = {
      transactionId: 'tx_001',
      reason: 'duplicate_charge',
    };
    expect(req.transactionId).toBe('tx_001');
    expectTypeOf(req.description).toMatchTypeOf<string | undefined>();
    expectTypeOf(req.priority).toMatchTypeOf<string | undefined>();
  });

  it('DisputeUpdate only has optional fields', () => {
    const update: DisputeUpdate = {
      status: 'resolved',
      resolutionNotes: 'Fixed',
      assignedTo: 'admin_2',
      priority: 'critical',
    };
    expect(update.status).toBe('resolved');
  });

  it('DisputeNote has all required fields', () => {
    const note: DisputeNote = {
      id: 'note_001',
      disputeId: 'disp_001',
      authorId: 'admin_1',
      content: 'Investigating',
      createdAt: Date.now(),
      isInternal: true,
    };
    expect(note.isInternal).toBe(true);
  });

  it('DisputeEscalation has all required fields', () => {
    const escalation: DisputeEscalation = {
      id: 'esc_001',
      disputeId: 'disp_001',
      escalatedBy: 'admin_1',
      reason: 'No response from customer',
      priority: 'high',
      escalatedAt: Date.now(),
    };
    expect(escalation.priority).toBe('high');
  });

  it('DisputeAnalytics has all required fields', () => {
    const analytics: DisputeAnalytics = {
      total: 10,
      byStatus: {
        open: 3,
        in_review: 2,
        resolved: 4,
        rejected: 0,
        escalated: 1,
      },
      byPriority: {
        low: 2,
        medium: 5,
        high: 2,
        critical: 1,
      },
      avgResolutionTimeMs: 86400000,
      escalationRate: 0.1,
      resolutionRate: 0.4,
    };
    expect(analytics.total).toBe(10);
    expect(analytics.resolutionRate).toBe(0.4);
  });

  it('DisputeAnalytics accepts null avgResolutionTimeMs', () => {
    const analytics: DisputeAnalytics = {
      total: 0,
      byStatus: {
        open: 0,
        in_review: 0,
        resolved: 0,
        rejected: 0,
        escalated: 0,
      },
      byPriority: {},
      avgResolutionTimeMs: null,
      escalationRate: 0,
      resolutionRate: 0,
    };
    expect(analytics.avgResolutionTimeMs).toBeNull();
  });
});
