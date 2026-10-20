export const Video = {
  compress: async (uri) => uri,
};

export const getVideoMetaData = async () => {
  throw new Error('Video metadata is unavailable on web.');
};