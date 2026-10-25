import { randomUUID } from "node:crypto";
import sharp from "sharp";

import getCloudinary from "../config/cloudinary.js";

const imageError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const prepareImage = async (file) => {
  if (!file.buffer?.length || file.buffer.length > 5 * 1024 * 1024) {
    throw imageError("Ảnh rỗng hoặc vượt quá 5 MB");
  }

  try {
    const options = {
      limitInputPixels: 25_000_000,
      failOn: "warning",
    };

    const metadata = await sharp(file.buffer, options).metadata();

    const mimeByFormat = {
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
    };

    if (!mimeByFormat[metadata.format]) {
      throw imageError("Nội dung file không phải ảnh JPEG, PNG hoặc WebP");
    }

    if (mimeByFormat[metadata.format] !== file.mimetype) {
      throw imageError("Loại file khai báo không khớp nội dung ảnh");
    }

    if ((metadata.pages ?? 1) > 1) {
      throw imageError("Không nhận ảnh động hoặc ảnh nhiều trang");
    }

    // Giải mã rồi tạo ảnh mới; không giữ nguyên file đầu vào.
    const { data, info } = await sharp(file.buffer, options)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      width: info.width,
      height: info.height,
      sizeBytes: data.length,
      mimeType: "image/webp",
    };
  } catch (error) {
    if (error.status === 400) {
      throw error;
    }

    throw imageError(
      "Không đọc được ảnh: file hỏng, không đúng định dạng hoặc vượt giới hạn kích thước",
    );
  }
};

const uploadImage = async ({ prepared, storageKey }) => {
  const cloudinary = getCloudinary();

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: storageKey,
        resource_type: "image",
        type: "authenticated",
        format: "webp",
        overwrite: false,
        timeout: 30000,
      },
      (error, response) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(response);
      },
    );

    stream.on("error", reject);
    stream.end(prepared.buffer);
  });

  return {
    url: result.secure_url,
    storageKey: result.public_id,
    sizeBytes: prepared.sizeBytes,
    mimeType: prepared.mimeType,
    width: prepared.width,
    height: prepared.height,
  };
};

const createStorageKey = (userId) => {
  return `hanoi-flood/reports/${userId}/${randomUUID()}`;
};

const removeImages = async (storageKeys) => {
  if (storageKeys.length === 0) return;

  const cloudinary = getCloudinary();

  const results = await Promise.allSettled(
    storageKeys.map((storageKey) =>
      cloudinary.uploader.destroy(storageKey, {
        resource_type: "image",
        type: "authenticated",
        invalidate: true,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (
      result.status === "rejected" ||
      !["ok", "not found"].includes(result.value?.result)
    ) {
      console.error("Chưa dọn được ảnh báo cáo:", storageKeys[index]);
    }
  });
};

export default {
  prepareImage,
  uploadImage,
  createStorageKey,
  removeImages,
};
