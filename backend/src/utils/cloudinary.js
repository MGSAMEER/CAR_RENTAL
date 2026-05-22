const cloudinary = require('cloudinary').v2;
const multer = require('multer');

const hasCloudinary = !!process.env.CLOUDINARY_CLOUD_NAME;

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME.trim(),
    api_key: process.env.CLOUDINARY_API_KEY.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET.trim(),
  });
}

// Memory storage is much faster and serverless/mobile friendly
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_FILE_TYPE'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Uploads a buffer directly to Cloudinary using a stream.
 * @param {Buffer} buffer - The file buffer
 * @param {String} folder - Cloudinary folder (e.g., "cars", "licenses")
 */
const uploadToCloudinary = (buffer, folder = 'driveeasy_general') => {
  return new Promise((resolve, reject) => {
    if (!hasCloudinary) {
      return reject(new Error('Cloudinary not configured'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'auto' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(buffer);
  });
};

/**
 * Deletes an image from Cloudinary given its public_id or full URL.
 */
const deleteFromCloudinary = async (imageUrl) => {
  if (!hasCloudinary || !imageUrl) return;
  try {
    // Extract public ID from the Cloudinary URL
    const urlParts = imageUrl.split('/');
    const fileWithExt = urlParts[urlParts.length - 1];
    const folder = urlParts[urlParts.length - 2];
    const filename = fileWithExt.split('.')[0];
    const publicId = `${folder}/${filename}`;

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
  }
};

module.exports = {
  cloudinary: hasCloudinary ? cloudinary : null,
  upload,
  uploadToCloudinary,
  deleteFromCloudinary,
};
