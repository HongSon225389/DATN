import multer from "multer";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

const receiveImages = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 3,
    fileSize: MAX_FILE_BYTES,
    fields: 6,
    fieldSize: 16 * 1024,
    parts: 9,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.mimetype)) {
      const error = new Error("Chỉ nhận ảnh JPEG, PNG hoặc WebP");
      error.status = 400;
      callback(error);
      return;
    }

    callback(null, true);
  },
}).array("images", 3);

const receiveReportImages = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    return res.status(400).json({
      message: "Báo cáo phải được gửi bằng multipart/form-data",
    });
  }

  receiveImages(req, res, (error) => {
    if (!error) {
      return next();
    }

    if (error instanceof multer.MulterError) {
      return res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
        message:
          error.code === "LIMIT_FILE_SIZE"
            ? "Mỗi ảnh không được vượt quá 5 MB"
            : "Form không hợp lệ: tối đa 3 ảnh, trường file phải tên images",
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return next(error);
  });
};

export default {
  receiveReportImages,
};
