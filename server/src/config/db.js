import mongoose from "mongoose";

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    console.warn(
      "Chưa cấu hình MONGODB_URI. API chạy với database chưa kết nối.",
    );

    return;
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.log("Đã kết nối MongoDB");
}
