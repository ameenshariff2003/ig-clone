const multer   = require("multer");
const AppError = require("../utils/AppError");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new AppError(
        `File type "${file.mimetype}" is not allowed. Upload JPEG, PNG, WebP, or AVIF only.`,
        415
      ),
      false
    );
  }
  cb(null, true);
};

const upload = multer({
  storage:   multer.memoryStorage(),
  fileFilter,
  limits:    { fileSize: MAX_FILE_SIZE_BYTES },
});

const handleMulterError = (err, _req, _res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")  return next(new AppError("Each image must be 5 MB or smaller.", 413));
    if (err.code === "LIMIT_FILE_COUNT") return next(new AppError("You can upload at most 4 images per product.", 413));
    return next(new AppError(`Upload error: ${err.message}`, 400));
  }
  next(err);
};

module.exports = { upload, handleMulterError };