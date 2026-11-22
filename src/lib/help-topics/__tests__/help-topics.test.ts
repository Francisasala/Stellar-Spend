import { describe, it, expect } from 'vitest';
import {
  HELP_TOPICS,
  HELP_CATEGORIES,
  type HelpTopic,
  gettingStartedTopics,
  walletTopics,
  sendingTopics,
  feesTopics,
  currenciesTopics,
  trackingTopics,
  refundsTopics,
  securityTopics,
  faqTopics,
  troubleshootingTopics,
} from '../index';

// ── Type guard ────────────────────────────────────────────────────────────────

function isValidTopic(topic: unknown): topic is HelpTopic {
  const t = topic as HelpTopic;
  return (
    typeof t.id === 'string' &&
    t.id.length > 0 &&
    typeof t.title === 'string' &&
    t.title.length > 0 &&
    typeof t.content === 'string' &&
    t.content.length > 0
  );
}

// ── HELP_TOPICS ───────────────────────────────────────────────────────────────

describe('HELP_TOPICS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(HELP_TOPICS)).toBe(true);
    expect(HELP_TOPICS.length).toBeGreaterThan(0);
  });

  it('contains 19 topics matching the original monolithic file', () => {
    expect(HELP_TOPICS).toHaveLength(19);
  });

  it('every topic satisfies the HelpTopic shape', () => {
    for (const topic of HELP_TOPICS) {
      expect(isValidTopic(topic)).toBe(true);
    }
  });

  it('no topic id is duplicated', () => {
    const ids = HELP_TOPICS.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('no topic title is duplicated', () => {
    const titles = HELP_TOPICS.map((t) => t.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('every topic has a non-empty content field', () => {
    for (const topic of HELP_TOPICS) {
      expect(topic.content.trim().length).toBeGreaterThan(0);
    }
  });

  it('every topic with keywords has at least one keyword', () => {
    for (const topic of HELP_TOPICS) {
      if (topic.keywords !== undefined) {
        expect(topic.keywords.length).toBeGreaterThan(0);
      }
    }
  });

  it('all category values align with a known HELP_CATEGORIES id', () => {
    const knownIds = new Set(HELP_CATEGORIES.map((c) => c.id));
    for (const topic of HELP_TOPICS) {
      if (topic.category !== undefined) {
        expect(knownIds.has(topic.category)).toBe(true);
      }
    }
  });
});

// ── HELP_CATEGORIES ───────────────────────────────────────────────────────────

describe('HELP_CATEGORIES', () => {
  it('contains exactly 10 categories', () => {
    expect(HELP_CATEGORIES).toHaveLength(10);
  });

  it('every category has a non-empty id and label', () => {
    for (const cat of HELP_CATEGORIES) {
      expect(cat.id.length).toBeGreaterThan(0);
      expect(cat.label.length).toBeGreaterThan(0);
    }
  });

  it('no category id is duplicated', () => {
    const ids = HELP_CATEGORIES.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('categories appear in the expected order', () => {
    const ids = HELP_CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      'getting-started',
      'wallet',
      'sending',
      'fees',
      'currencies',
      'tracking',
      'refunds',
      'security',
      'faq',
      'troubleshooting',
    ]);
  });
});

// ── Per-category module exports ───────────────────────────────────────────────

describe('per-category topic modules', () => {
  const allModules = [
    {
      name: 'gettingStartedTopics',
      topics: gettingStartedTopics,
      category: 'getting-started',
      expectedCount: 2,
    },
    { name: 'walletTopics', topics: walletTopics, category: 'wallet', expectedCount: 2 },
    { name: 'sendingTopics', topics: sendingTopics, category: 'sending', expectedCount: 2 },
    { name: 'feesTopics', topics: feesTopics, category: 'fees', expectedCount: 2 },
    {
      name: 'currenciesTopics',
      topics: currenciesTopics,
      category: 'currencies',
      expectedCount: 2,
    },
    { name: 'trackingTopics', topics: trackingTopics, category: 'tracking', expectedCount: 2 },
    { name: 'refundsTopics', topics: refundsTopics, category: 'refunds', expectedCount: 2 },
    { name: 'securityTopics', topics: securityTopics, category: 'security', expectedCount: 1 },
    { name: 'faqTopics', topics: faqTopics, category: 'faq', expectedCount: 3 },
    {
      name: 'troubleshootingTopics',
      topics: troubleshootingTopics,
      category: 'troubleshooting',
      expectedCount: 1,
    },
  ] as const;

  for (const mod of allModules) {
    describe(mod.name, () => {
      it(`has ${mod.expectedCount} topic(s)`, () => {
        expect(mod.topics).toHaveLength(mod.expectedCount);
      });

      it('every topic has the correct category', () => {
        for (const topic of mod.topics) {
          expect(topic.category).toBe(mod.category);
        }
      });

      it('every topic satisfies the HelpTopic shape', () => {
        for (const topic of mod.topics) {
          expect(isValidTopic(topic)).toBe(true);
        }
      });
    });
  }

  it('all per-category arrays together equal HELP_TOPICS', () => {
    const assembled = [
      ...gettingStartedTopics,
      ...walletTopics,
      ...sendingTopics,
      ...feesTopics,
      ...currenciesTopics,
      ...trackingTopics,
      ...refundsTopics,
      ...securityTopics,
      ...faqTopics,
      ...troubleshootingTopics,
    ];
    expect(assembled).toHaveLength(HELP_TOPICS.length);
    expect(assembled.map((t) => t.id)).toEqual(HELP_TOPICS.map((t) => t.id));
  });
});

// ── Spot-check specific well-known topics ─────────────────────────────────────

describe('spot-checks on specific topics', () => {
  it('getting-started topic exists with expected content', () => {
    const topic = HELP_TOPICS.find((t) => t.id === 'getting-started');
    expect(topic).toBeDefined();
    expect(topic?.title).toBe('Getting Started');
    expect(topic?.content).toContain('Minimum transfer: 0.70 USDC');
  });

  it('fees topic contains the platform fee percentage', () => {
    const topic = HELP_TOPICS.find((t) => t.id === 'fees');
    expect(topic).toBeDefined();
    expect(topic?.content).toContain('0.35%');
  });

  it('security topic warns against sharing seed phrases', () => {
    const topic = HELP_TOPICS.find((t) => t.id === 'security');
    expect(topic).toBeDefined();
    expect(topic?.content).toContain('seed phrase');
  });

  it('faq-minimum topic specifies 0.70 USDC', () => {
    const topic = HELP_TOPICS.find((t) => t.id === 'faq-minimum');
    expect(topic).toBeDefined();
    expect(topic?.content).toContain('0.70 USDC');
  });

  it('bank-verification topic cautions about irreversibility', () => {
    const topic = HELP_TOPICS.find((t) => t.id === 'bank-verification');
    expect(topic).toBeDefined();
    expect(topic?.content).toContain('cannot be reversed');
  });
});
