// Profile Image — random-once selection from asset pool
//
// Picks a random profile image on first load and persists the choice
// in localStorage. Re-rolls if the stored image is no longer in the pool.

const STORAGE_KEY = 'player-profile-image';

/**
 * Get the player's profile image path.
 * Returns a persisted random choice, or picks a new one.
 *
 * @param {string[]} images - Available image paths (from config)
 * @param {string} [storageKey] - Override localStorage key (for testing)
 * @returns {string|null} Image path or null if no images available
 */
export function getProfileImage(images, storageKey = STORAGE_KEY) {
  if (!images || images.length === 0) return null;

  const stored = localStorage.getItem(storageKey);
  if (stored && images.includes(stored)) return stored;

  const pick = images[Math.floor(Math.random() * images.length)];
  localStorage.setItem(storageKey, pick);
  return pick;
}
