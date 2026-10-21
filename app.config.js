// Extends app.json with values that must not live in source control.
module.exports = ({ config }) => ({
  ...config,
  // Tells the app whether this build has a Google Maps key (never the key itself)
  extra: { ...config.extra, androidMapsKey: !!process.env.GOOGLE_MAPS_API_KEY },
  // Expo Go only loads updates labelled with its SDK version: EXPO_GO_UPDATE=1 eas update --branch expo-go
  ...(process.env.EXPO_GO_UPDATE && { runtimeVersion: `exposdk:${require('expo/package.json').version.split('.')[0]}.0.0` }),
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
    },
  },
});
