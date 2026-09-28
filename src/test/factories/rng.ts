/**
 * Deterministic seedable RNG (mulberry32 algorithm).
 * Produces the same sequence for a given seed — critical for reproducible tests.
 *
 * Usage:
 *   const rng = createRng(42);
 *   rng.nextFloat(); // always 0.6234... for seed=42
 */

export interface Rng {
  /** Returns a float in [0, 1) */
  nextFloat(): number;
  /** Returns an integer in [min, max] (inclusive) */
  nextInt(min: number, max: number): number;
  /** Picks a random element from the array */
  pick<T>(arr: readonly T[]): T;
  /** Returns a random hex string of `bytes` bytes */
  hex(bytes: number): string;
  /** Returns a random alphanumeric string of `length` chars */
  alpha(length: number): string;
}

export function createRng(seed: number = 1): Rng {
  let s = seed >>> 0;

  function nextFloat(): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  return {
    nextFloat,
    nextInt(min, max) {
      return min + Math.floor(nextFloat() * (max - min + 1));
    },
    pick<T>(arr: readonly T[]): T {
      return arr[Math.floor(nextFloat() * arr.length)];
    },
    hex(bytes) {
      let result = '';
      for (let i = 0; i < bytes; i++) {
        result += Math.floor(nextFloat() * 256)
          .toString(16)
          .padStart(2, '0');
      }
      return result;
    },
    alpha(length) {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(nextFloat() * chars.length)];
      }
      return result;
    },
  };
}

/** Shared default RNG. Reset per-suite via `resetDefaultRng()`. */
let _defaultRng = createRng(1);

export function getDefaultRng(): Rng {
  return _defaultRng;
}

export function resetDefaultRng(seed: number = 1): void {
  _defaultRng = createRng(seed);
}
