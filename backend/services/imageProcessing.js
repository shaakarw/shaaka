const sharp = require('sharp');

const IMAGE_VARIANTS = [
  { quality: 'tiny', width: 64, webpQuality: 45 },
  { quality: 'small', width: 240, webpQuality: 65 },
  { quality: 'medium', width: 640, webpQuality: 76 },
  { quality: 'large', width: 1080, webpQuality: 82 },
];

async function createImageVariants(buffer) {
  const image = sharp(buffer, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions could not be determined.');

  const sourceSize = Math.max(metadata.width, metadata.height);
  const variants = {};
  let previousDimensions = '';
  let minimumSourceSize = IMAGE_VARIANTS[0].width;
  for (const definition of IMAGE_VARIANTS) {
    if (sourceSize <= minimumSourceSize) {
      minimumSourceSize = definition.width;
      continue;
    }
    const result = await image
      .clone()
      .resize({ width: definition.width, height: definition.width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: definition.webpQuality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const dimensions = `${result.info.width}x${result.info.height}`;
    if (dimensions === previousDimensions) continue;
    previousDimensions = dimensions;
    variants[definition.quality] = {
      buffer: result.data,
      mimeType: 'image/webp',
      width: result.info.width,
      height: result.info.height,
      fileSize: result.info.size,
    };
    minimumSourceSize = definition.width;
  }

  return {
    width: metadata.width,
    height: metadata.height,
    variants,
  };
}

module.exports = { createImageVariants };
