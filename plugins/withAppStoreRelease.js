// App Store builds (EAS profile "production") only:
//  - drop the local-network permission and Bonjour entries that expo-dev-client adds for finding a dev server on
//    the Wi-Fi; a store build never does that, and App Review asks about permissions an app doesn't use;
//  - mark push notifications as production (expo-notifications writes "development"; Xcode's App Store export
//    switches it too, this makes the intent explicit).
// Development and preview builds are untouched.
const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

const isStoreBuild = () => process.env.EAS_BUILD_PROFILE === 'production';

module.exports = function withAppStoreRelease(config) {
  config = withInfoPlist(config, cfg => {
    if (isStoreBuild()) {
      delete cfg.modResults.NSLocalNetworkUsageDescription;
      delete cfg.modResults.NSBonjourServices;
    }
    return cfg;
  });
  return withEntitlementsPlist(config, cfg => {
    if (isStoreBuild()) cfg.modResults['aps-environment'] = 'production';
    return cfg;
  });
};
