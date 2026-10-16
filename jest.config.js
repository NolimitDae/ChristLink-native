module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: [],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/supabase/'],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/Avatar.tsx',
    '!lib/supabase.ts',
    '!lib/features.ts',
    '!lib/notifications.ts',
    '!lib/storage.ts',
    '!lib/haptics.ts',
    '!lib/validation.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
};
