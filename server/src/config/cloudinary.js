import { v2 as cloudinary } from "cloudinary";

let configured = false;

const getCloudinary = () => {
  if (configured) {
    return cloudinary;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error("Chưa cấu hình dịch vụ lưu ảnh");
    error.status = 503;
    throw error;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  configured = true;

  return cloudinary;
};

export default getCloudinary;
