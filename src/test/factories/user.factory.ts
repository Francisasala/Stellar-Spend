import { makeStellarAddress } from './transaction.factory';
import { getDefaultRng, type Rng } from './rng';

export interface User {
  id: string;
  address: string;
  email?: string;
  createdAt: number;
}

let _counter = 0;

export function makeUser(overrides: Partial<User> = {}, rng: Rng = getDefaultRng()): User {
  const n = ++_counter;
  return {
    id: `user_test_${n.toString().padStart(4, '0')}`,
    address: makeStellarAddress(rng),
    email: `user${n}@test.example`,
    createdAt: 1_700_000_000_000 + n * 1000,
    ...overrides,
  };
}

export function makeUsers(count: number, overrides: Partial<User> = {}, rng?: Rng): User[] {
  return Array.from({ length: count }, () => makeUser(overrides, rng));
}

export function resetUserCounter(): void {
  _counter = 0;
}
