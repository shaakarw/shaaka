let startupPerformanceActive = true;

export const isStartupPerformanceActive = () => startupPerformanceActive;

export const finishStartupPerformance = () => {
  startupPerformanceActive = false;
};