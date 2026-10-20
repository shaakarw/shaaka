const getCompressor = () => {
  try {
    return require('react-native-compressor');
  } catch (error) {
    return null;
  }
};

export const getVideoMetaData = async (uri) => {
  const compressor = getCompressor();
  if (!compressor?.getVideoMetaData) {
    return {};
  }

  try {
    return await compressor.getVideoMetaData(uri);
  } catch (error) {
    return {};
  }
};

export const Video = {
  compress: async (uri, options = {}) => {
    const compressor = getCompressor();
    if (!compressor?.Video?.compress) {
      return uri;
    }

    try {
      return await compressor.Video.compress(uri, options);
    } catch (error) {
      return uri;
    }
  },
};