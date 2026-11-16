const MIME_TYPE_EXTENSIONS = {
  'video/3gpp': '3gp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-matroska': 'mkv',
  'video/x-msvideo': 'avi',
};

const getVideoExtension = asset => {
  const fileName = String(asset?.fileName || '');
  const fileExtension = fileName.match(/\.([a-z0-9]+)$/i)?.[1];
  if (fileExtension) return fileExtension.toLowerCase();

  const mimeType = String(asset?.mimeType || '').toLowerCase().split(';')[0];
  return MIME_TYPE_EXTENSIONS[mimeType] || mimeType.split('/')[1]?.replace(/^x-/, '') || 'mp4';
};

const getVideoMetaData = asset => ({
  width: asset?.width,
  height: asset?.height,
  duration: Number(asset?.duration) / 1000,
  extension: getVideoExtension(asset),
});

const validateVideoMetadata = metadata => {
  const duration = Number(metadata?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('Unsupported video. Please select a valid video with a readable duration.');
  }

  const width = Number(metadata?.width);
  const height = Number(metadata?.height);
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new Error('Unable to read this video\'s dimensions. Please select another video.');
  }

  return { ...metadata, duration, width, height };
};

module.exports = {
  getVideoMetaData,
  validateVideoMetadata,
};
