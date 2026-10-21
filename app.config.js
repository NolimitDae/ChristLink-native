// Extends app.json with values that must not live in source control.
module.exports = ({ config }) => ({
  ...config,
  // Tells the app whether this build has a Google Maps key (never the key itself)
  extra: { ...config.extra, androidMapsKey: !!process.env.GOOGLE_MAPS_API_KEY },
  android: {
    ...config.android,
    config: {
      ...(config.android?.config ?? {}),
      googleMaps: { apiKey: process.env.GOOGLE_MAPS_API_KEY ?? '' },
    },
  },
});
