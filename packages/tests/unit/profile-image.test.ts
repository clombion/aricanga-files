import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getProfileImage } from '../../framework/src/systems/conversation/services/profile-image.js';

const TEST_KEY = 'test-profile-image';
const IMAGES = ['profile_images/optimized/profile-1.jpg', 'profile_images/optimized/profile-2.jpg', 'profile_images/optimized/profile-3.jpg'];

// Use a manual localStorage mock to avoid happy-dom corruption in parallel runs
const store = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', localStorageMock);
});

describe('getProfileImage', () => {
  it('returns null for empty array', () => {
    expect(getProfileImage([], TEST_KEY)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getProfileImage(undefined as any, TEST_KEY)).toBeNull();
  });

  it('picks from the pool', () => {
    const result = getProfileImage(IMAGES, TEST_KEY);
    expect(IMAGES).toContain(result);
  });

  it('persists choice in localStorage', () => {
    const result = getProfileImage(IMAGES, TEST_KEY);
    expect(localStorage.getItem(TEST_KEY)).toBe(result);
  });

  it('returns persisted choice on subsequent calls', () => {
    const first = getProfileImage(IMAGES, TEST_KEY);
    const second = getProfileImage(IMAGES, TEST_KEY);
    expect(second).toBe(first);
  });

  it('re-rolls if stored image no longer in pool', () => {
    localStorage.setItem(TEST_KEY, 'profile_images/optimized/deleted.jpg');
    const result = getProfileImage(IMAGES, TEST_KEY);
    expect(IMAGES).toContain(result);
  });

  it('keeps stored choice if still in pool', () => {
    localStorage.setItem(TEST_KEY, IMAGES[1]);
    const result = getProfileImage(IMAGES, TEST_KEY);
    expect(result).toBe(IMAGES[1]);
  });
});
