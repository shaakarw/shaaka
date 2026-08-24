const cloudinary = require('cloudinary').v2;

// Read from environment
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

// Only configure if all values exist
if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  console.log('✅ Cloudinary configured with provided credentials');
} else {
  console.warn('⚠️ Cloudinary credentials missing – uploads will be skipped.');
  // Set dummy config to avoid runtime errors
  cloudinary.config({
    cloud_name: 'dummy',
    api_key: 'dummy',
    api_secret: 'dummy',
  });
}

module.exports = cloudinary;