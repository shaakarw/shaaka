
module.exports = ({ config }) => {
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

  return {
    ...config,

    plugins: [
      ...(config.plugins || []),
      "expo-splash-screen",
    ],

    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
