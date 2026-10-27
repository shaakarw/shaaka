import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';

const DEFAULT_MAX_BYTES = 100 * 1024;
const MIN_DIMENSION = 240;
const MAX_DIMENSION = 1600;
const QUALITY_SEQUENCE = [0.85, 0.65, 0.45, 0.25, 0.12];

const getImageDimensions = (uri) => new Promise((resolve, reject) => {
  Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
});

export const compressImageForUpload = async (
  uri,
  name = `image_${Date.now()}.jpg`,
  maxBytes = DEFAULT_MAX_BYTES
) => {
  if (!uri) throw new Error('No image selected.');

  const { width, height } = await getImageDimensions(uri);
  const originalMaxDimension = Math.max(width, height);
  let targetMaxDimension = Math.min(originalMaxDimension, MAX_DIMENSION);
  const minimumDimension = Math.min(originalMaxDimension, MIN_DIMENSION);

  while (true) {
    const scale = targetMaxDimension / originalMaxDimension;
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    for (const quality of QUALITY_SEQUENCE) {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
      );
      const info = await FileSystem.getInfoAsync(result.uri);

      if (!info.exists || typeof info.size !== 'number') {
        throw new Error('Unable to verify the compressed image size.');
      }
      if (info.size < maxBytes) {
        return {
          uri: result.uri,
          type: 'image/jpeg',
          name: name.replace(/\.[^.]+$/, '.jpg'),
          size: info.size,
        };
      }
    }

    if (targetMaxDimension <= minimumDimension) {
      throw new Error('Could not compress this image below 100 KB. Please choose another image.');
    }
    targetMaxDimension = Math.max(minimumDimension, Math.floor(targetMaxDimension * 0.8));
  }
};
