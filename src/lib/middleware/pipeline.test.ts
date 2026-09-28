import { describe, it, expect, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { composeGuards, composeTransforms } from './pipeline';

function makeRequest(path = '/api/test') {
  return new NextRequest(`http://localhost${path}`);
}

describe('composeGuards', () => {
  it('returns null when every guard allows the request through', () => {
    const allow = vi.fn(() => null);
    const run = composeGuards(allow, allow);

    const result = run(makeRequest());

    expect(result).toBeNull();
    expect(allow).toHaveBeenCalledTimes(2);
  });

  it('short-circuits on the first guard that returns a response', () => {
    const blocked = NextResponse.json({ error: 'blocked' }, { status: 403 });
    const first = vi.fn(() => blocked);
    const second = vi.fn(() => null);
    const run = composeGuards(first, second);

    const result = run(makeRequest());

    expect(result).toBe(blocked);
    expect(second).not.toHaveBeenCalled();
  });

  it('runs guards in the order they were passed', () => {
    const calls: string[] = [];
    const a = vi.fn(() => {
      calls.push('a');
      return null;
    });
    const b = vi.fn(() => {
      calls.push('b');
      return null;
    });
    composeGuards(a, b)(makeRequest());

    expect(calls).toEqual(['a', 'b']);
  });
});

describe('composeTransforms', () => {
  it('applies every transform in order, threading the response through each', () => {
    const run = composeTransforms(
      (res) => {
        res.headers.set('x-step', '1');
        return res;
      },
      (res) => {
        res.headers.set('x-step', res.headers.get('x-step') + '-2');
        return res;
      },
    );

    const result = run(NextResponse.next(), makeRequest());

    expect(result.headers.get('x-step')).toBe('1-2');
  });

  it('passes the original request to every transform', () => {
    const request = makeRequest('/api/v1/transactions');
    const seen: string[] = [];
    const run = composeTransforms(
      (res, req) => {
        seen.push(new URL(req.url).pathname);
        return res;
      },
      (res, req) => {
        seen.push(new URL(req.url).pathname);
        return res;
      },
    );

    run(NextResponse.next(), request);

    expect(seen).toEqual(['/api/v1/transactions', '/api/v1/transactions']);
  });

  it('runs unconditionally even on an already short-circuited response', () => {
    const blocked = NextResponse.json({ error: 'blocked' }, { status: 403 });
    const run = composeTransforms((res) => {
      res.headers.set('x-decorated', 'true');
      return res;
    });

    const result = run(blocked, makeRequest());

    expect(result.status).toBe(403);
    expect(result.headers.get('x-decorated')).toBe('true');
  });
});
