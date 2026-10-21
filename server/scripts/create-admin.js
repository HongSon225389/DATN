import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";

dotenv.config({
  path: new URL("../.env", import.meta.url),
  quiet: true,
});

const createAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME?.trim();
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!name || name.length < 2 || name.length > 100) {
      throw new Error("ADMIN_NAME cần từ 2 đến 100 ký tự");
    }

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error("ADMIN_EMAIL không hợp lệ");
    }

    if (
      !password ||
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error(
        "ADMIN_PASSWORD cần ít nhất 12 ký tự và không quá 72 byte UTF-8",
      );
    }

    if (password === "THAY_BANG_MAT_KHAU_RIENG") {
      throw new Error("Hãy thay mật khẩu mẫu bằng mật khẩu riêng");
    }

    await connectDB();
    await User.init();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      throw new Error(
        "Email đã tồn tại. Script không thay đổi quyền hoặc mật khẩu tài khoản cũ.",
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await User.create({
      name,
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    });

    console.log("Đã tạo tài khoản Admin.");

    console.table({
      id: admin._id.toString(),
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
  } catch (error) {
    if (error.code === 11000) {
      console.error("Tạo Admin thất bại: email đã tồn tại.");
    } else {
      console.error("Tạo Admin thất bại:", error.message);
    }

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
