export const logPerformance = message => {
  if (process.env.EXPO_PUBLIC_PERF_LOGS === 'true') {
    console.info(message);
  }
};
