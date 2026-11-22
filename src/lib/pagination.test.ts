import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, parsePaginationQuery, trimLookahead } from './pagination';

describe('parsePaginationQuery', () => {
  const options = { defaultLimit: 50, maxLimit: 200 };

  it('uses defaults when params are missing', () => {
    expect(parsePaginationQuery(new URLSearchParams(), options)).toEqual({
      cursor: null,
      offset: 0,
      limit: 50,
    });
  });

  it('decodes cursor into offset', () => {
    const cursor = encodeCursor(30);
    const parsed = parsePaginationQuery(new URLSearchParams({ cursor, limit: '10' }), options);
    expect(parsed).toEqual({ cursor, offset: 30, limit: 10 });
    expect(decodeCursor(cursor)).toBe(30);
  });

  it('falls back to default for non-numeric limit', () => {
    expect(parsePaginationQuery(new URLSearchParams({ limit: 'abc' }), options).limit).toBe(50);
  });

  it('clamps limit to the max and to at least 1', () => {
    expect(parsePaginationQuery(new URLSearchParams({ limit: '999' }), options).limit).toBe(200);
    expect(parsePaginationQuery(new URLSearchParams({ limit: '0' }), options).limit).toBe(1);
    expect(parsePaginationQuery(new URLSearchParams({ limit: '-5' }), options).limit).toBe(1);
  });
});

describe('trimLookahead', () => {
  it('returns all items and hasMore=false when within limit', () => {
    expect(trimLookahead([1, 2], 3)).toEqual({ data: [1, 2], hasMore: false });
  });

  it('trims the lookahead item and reports hasMore=true', () => {
    expect(trimLookahead([1, 2, 3], 2)).toEqual({ data: [1, 2], hasMore: true });
  });

  it('returns hasMore=false when exactly limit items are present', () => {
    expect(trimLookahead([1, 2], 2)).toEqual({ data: [1, 2], hasMore: false });
  });
});
