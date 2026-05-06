import multer from "multer";

// ✅ Menggunakan memoryStorage (kompatibel dengan multer v2)
// File disimpan di memory sebagai Buffer, lalu di-upload manual ke Cloudinary
const storage = multer.memoryStorage();

export const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/png' || 
    file.mimetype === 'image/jpg' || 
    file.mimetype === 'image/jpeg' || 
    file.mimetype === 'image/webp'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (PNG, JPG, JPEG, WEBP) are allowed!'), false);
  }
};

// Single multer instance menggunakan memoryStorage
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Max 5MB
  },
});
