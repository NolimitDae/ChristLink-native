// Web build of expo-secure-store (metro.config.js maps it here for web only). Browsers have no keychain, so values
// live in localStorage, like the old website's session did (docs/SECURITY.md). Blocked storage reads as empty.
const safe = (fn, fallback) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};
module.exports = {
  getItemAsync: async (k) => safe(() => localStorage.getItem(k), null),
  setItemAsync: async (k, v) => safe(() => localStorage.setItem(k, v), undefined),
  deleteItemAsync: async (k) => safe(() => localStorage.removeItem(k), undefined),
  isAvailableAsync: async () => safe(() => typeof localStorage !== 'undefined', false),
  AFTER_FIRST_UNLOCK: 0,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  WHEN_UNLOCKED: 2,
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 3,
};
