const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

const isPlaceholder = (value) => !value || /^YOUR_/i.test(value);

const imageCredentials = {
  cloud_name: isPlaceholder(process.env.IMAGE_CLOUD_NAME)
    ? process.env.CLOUDINARY_CLOUD_NAME
    : process.env.IMAGE_CLOUD_NAME,
  api_key: isPlaceholder(process.env.IMAGE_API_KEY)
    ? process.env.CLOUDINARY_API_KEY
    : process.env.IMAGE_API_KEY,
  api_secret: isPlaceholder(process.env.IMAGE_API_SECRET)
    ? process.env.CLOUDINARY_API_SECRET
    : process.env.IMAGE_API_SECRET,
};

const videoCredentials = {
  cloud_name: process.env.VIDEO_CLOUD_NAME,
  api_key: process.env.VIDEO_API_KEY,
  api_secret: process.env.VIDEO_API_SECRET,
};

const imageCloudinary = { resourceType: 'image', credentials: imageCredentials };
const videoCloudinary = { resourceType: 'video', credentials: videoCredentials };

let operationQueue = Promise.resolve();

const isConfigured = (client) => Object.values(client.credentials).every(
  value => value && !isPlaceholder(value)
);

const missingCredentials = (client) => Object.entries(client.credentials)
  .filter(([, value]) => !value || isPlaceholder(value))
  .map(([name]) => name);

// The installed Cloudinary SDK exposes one process-wide v2 client. Serialize
// configuration changes so the two account credentials cannot cross streams.
const withClient = (client, operation) => {
  const operationPromise = operationQueue.then(async () => {
    const previous = { ...cloudinary.config() };
    cloudinary.config(client.credentials);
    try {
      return await operation(cloudinary);
    } finally {
      cloudinary.config(previous);
    }
  });
  operationQueue = operationPromise.catch(() => {});
  return operationPromise;
};

const uploadBuffer = (client, buffer, options = {}) => {
  if (!isConfigured(client)) {
    const missing = missingCredentials(client).join(', ');
    return Promise.reject(new Error(`${client.resourceType} Cloudinary is not configured. Missing: ${missing}`));
  }
  return withClient(client, sdk => new Promise((resolve, reject) => {
    const uploadOptions = {
      ...options,
      resource_type: client.resourceType,
    };
    if (client.resourceType === 'image') {
      uploadOptions.transformation = [
        {
          width: 1200,
          height: 1200,
          crop: 'limit',
          quality: 50,
          fetch_format: 'webp',
        },
        ...(options.transformation || []),
      ];
    }
    const uploadStream = sdk.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  }));
};

const destroyMedia = (client, publicId) => {
  if (!publicId || !isConfigured(client)) return Promise.resolve(null);
  return withClient(client, sdk => sdk.uploader.destroy(publicId, {
    resource_type: client.resourceType,
  }));
};

module.exports = {
  imageCloudinary,
  videoCloudinary,
  uploadBuffer,
  destroyMedia,
  isConfigured,
};