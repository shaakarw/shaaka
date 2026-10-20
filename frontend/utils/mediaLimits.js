export const MAX_MEDIA_HEIGHT_RATIO = 0.7;

export const getMaxMediaHeight = (windowHeight) =>
  Math.max(1, Math.floor(windowHeight * MAX_MEDIA_HEIGHT_RATIO));