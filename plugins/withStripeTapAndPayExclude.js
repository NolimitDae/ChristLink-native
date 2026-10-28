// Stripe RN's Android module declares `compileOnly com.stripe:stripe-android-issuing-push-provisioning`, whose POM
// pulls `com.google.android.gms:play-services-tapandpay`. Google only ships that library to approved card issuers,
// so it is in no public Maven repo and every Android release build fails while resolving it. We don't push-provision
// cards to Google Wallet (Stripe reaches those classes by reflection), so:
//  1. the tapandpay library is excluded from every Gradle configuration, and
//  2. R8 is told the compile-only push-provisioning classes are intentionally absent from the release APK.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withProjectBuildGradle } = require('expo/config-plugins');

const MARKER = '// @christlink/stripe-tapandpay-exclude';
const GRADLE_SNIPPET = `
${MARKER}
allprojects {
  configurations.configureEach {
    exclude group: 'com.google.android.gms', module: 'play-services-tapandpay'
  }
}
`;

const PROGUARD_MARKER = '# @christlink/stripe-push-provisioning';
const PROGUARD_SNIPPET = `
${PROGUARD_MARKER}
# Stripe push provisioning is compileOnly (not shipped); the code paths that use it are never called.
-dontwarn com.stripe.android.pushProvisioning.**
-dontwarn com.google.android.gms.tapandpay.**
`;

function withGradleExclude(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withStripeTapAndPayExclude expects a Groovy android/build.gradle');
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += GRADLE_SNIPPET;
    }
    return cfg;
  });
}

function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!current.includes(PROGUARD_MARKER)) {
        fs.writeFileSync(file, current + PROGUARD_SNIPPET);
      }
      return cfg;
    },
  ]);
}

module.exports = function withStripeTapAndPayExclude(config) {
  return withProguardRules(withGradleExclude(config));
};
