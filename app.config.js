// Extends app.json with values that must not live in source control.

// EAS cloud builds never see .env.local; their values come from EAS environment variables
// (`eas env:create`). Fail the build early instead of shipping an app that crashes on launch.
const REQUIRED_ON_EAS = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'EXPO_PUBLIC_API_BASE'];
if (process.env.EAS_BUILD === 'true') {
  const missing = REQUIRED_ON_EAS.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing EAS environment variables: ${missing.join(', ')}. Add them with \`eas env:create\` for this build's environment.`,
    );
  }
}

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
    },
  },
});
