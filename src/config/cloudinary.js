import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload buffer ke Cloudinary menggunakan upload_stream
 * Kompatibel dengan multer v2 (memoryStorage)
 * 
 * @param {Buffer} fileBuffer - Buffer dari req.file.buffer
 * @param {Object} options - Cloudinary upload options (folder, public_id, transformation, dll)
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    stream.end(fileBuffer);
  });
};

/**
 * Upload course thumbnail ke Cloudinary
 * @param {Object} file - req.file dari multer memoryStorage
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const uploadCourseThumbnail = async (file) => {
  return uploadToCloudinary(file.buffer, {
    folder: 'go-learn/courses',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: `thumbnail-${Date.now()}`,
    transformation: [
      { width: 1200, height: 675, crop: 'limit' },
      { quality: 'auto' },
    ],
  });
};

/**
 * Upload student photo ke Cloudinary
 * @param {Object} file - req.file dari multer memoryStorage
 * @returns {Promise<Object>} - Cloudinary upload result
 */
export const uploadStudentPhoto = async (file) => {
  return uploadToCloudinary(file.buffer, {
    folder: 'go-learn/students',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    public_id: `photo-${Date.now()}`,
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' },
    ],
  });
};

/**
 * Extract public_id dari Cloudinary URL untuk keperluan delete
 * URL format: https://res.cloudinary.com/xxx/image/upload/v123456/go-learn/courses/filename.ext
 * @param {string} cloudinaryUrl - Full URL dari Cloudinary
 * @returns {string|null} - public_id atau null jika gagal parse
 */
export const extractPublicId = (cloudinaryUrl) => {
  try {
    const urlParts = cloudinaryUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    if (uploadIndex > 0 && uploadIndex + 2 < urlParts.length) {
      // Ambil semua bagian setelah version (v123456)
      const pathAfterVersion = urlParts.slice(uploadIndex + 2).join('/');
      // Hapus extension file
      const publicId = pathAfterVersion.replace(/\.[^/.]+$/, '');
      return publicId;
    }
    return null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

/**
 * Hapus file dari Cloudinary berdasarkan URL
 * @param {string} cloudinaryUrl - Full URL dari Cloudinary
 */
export const deleteFromCloudinary = async (cloudinaryUrl) => {
  const publicId = extractPublicId(cloudinaryUrl);
  if (publicId) {
    await cloudinary.uploader.destroy(publicId);
    console.log('Deleted from Cloudinary:', publicId);
  }
};

export default cloudinary;
