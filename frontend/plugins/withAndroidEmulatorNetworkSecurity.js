const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

const withAndroidEmulatorNetworkSecurity = config => {
  config = withAndroidManifest(config, modConfig => {
    const application = modConfig.modResults.manifest.application?.[0];
    if (!application) {
      throw new Error('Android manifest is missing its application element.');
    }
    application.$ = application.$ || {};
    application.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return modConfig;
  });

  return withDangerousMod(config, ['android', async modConfig => {
    const resourceDirectory = path.join(
      modConfig.modRequest.platformProjectRoot,
      'app',
      'src',
      'main',
      'res',
      'xml'
    );
    await fs.promises.mkdir(resourceDirectory, { recursive: true });
    await fs.promises.writeFile(
      path.join(resourceDirectory, 'network_security_config.xml'),
      NETWORK_SECURITY_CONFIG,
      'utf8'
    );
    return modConfig;
  }]);
};

module.exports = withAndroidEmulatorNetworkSecurity;
