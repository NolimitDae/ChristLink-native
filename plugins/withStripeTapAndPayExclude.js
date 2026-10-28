// Stripe RN's Android module declares `compileOnly com.stripe:stripe-android-issuing-push-provisioning`, whose POM
// pulls `com.google.android.gms:play-services-tapandpay`. Google only ships that library to approved card issuers,
// so it is in no public Maven repo and every Android release build fails while resolving it. We don't push-provision
// cards to Google Wallet (Stripe reaches those classes by reflection), so the library is excluded everywhere.
const { withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @christlink/stripe-tapandpay-exclude';
const SNIPPET = `
${MARKER}
allprojects {
  configurations.configureEach {
    exclude group: 'com.google.android.gms', module: 'play-services-tapandpay'
  }
}
`;

module.exports = function withStripeTapAndPayExclude(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withStripeTapAndPayExclude expects a Groovy android/build.gradle');
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
