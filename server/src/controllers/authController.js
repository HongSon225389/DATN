import bcrypt from "bcryptjs";

import User from "../models/User.js";
import tokenUtils from "../utils/token.js";

const formatUser = (user) => {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
  };
};

// POST /api/auth/register
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Tên, email và mật khẩu phải là chuỗi",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
      return res.status(400).json({
        message: "Tên phải có từ 2 đến 100 ký tự",
      });
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return res.status(400).json({
        message: "Email không hợp lệ",
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        message: "Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8",
      });
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email đã được sử dụng",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = new User({
      name: normalizedName,
      email: normalizedEmail,
      passwordHash,

      // Không nhận role hoặc isActive từ request.
      role: "user",
      isActive: true,
    });

    // Tạo token trước khi lưu để phát hiện lỗi cấu hình.
    const token = tokenUtils.generateToken(user._id, user.tokenVersion ?? 0);

    await user.save();

    return res.status(201).json({
      user: formatUser(user),
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Email đã được sử dụng",
      });
    }

    console.error("Lỗi đăng ký:", error);

    return res.status(500).json({
      message: "Không thể đăng ký tài khoản",
    });
  }
};

// POST /api/auth/login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      email.length > 254 ||
      password.length < 1 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Thông tin đăng nhập không hợp lệ",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash +tokenVersion");

    const isPasswordValid = user
      ? await bcrypt.compare(password, user.passwordHash)
      : false;

    if (!user || !isPasswordValid || !user.isActive) {
      return res.status(401).json({
        message: "Thông tin đăng nhập không đúng hoặc tài khoản không khả dụng",
      });
    }

    return res.status(200).json({
      user: formatUser(user),
      token: tokenUtils.generateToken(user._id, user.tokenVersion ?? 0),
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);

    return res.status(500).json({
      message: "Không thể đăng nhập",
    });
  }
};

// GET /api/auth/me
const getCurrentUser = (req, res) => {
  return res.status(200).json({
    user: formatUser(req.user),
  });
};

// GET /api/auth/admin-check
const checkAdmin = (req, res) => {
  return res.status(200).json({
    message: "Bạn có quyền Admin",
  });
};

export default {
  registerUser,
  loginUser,
  getCurrentUser,
  checkAdmin,
};
