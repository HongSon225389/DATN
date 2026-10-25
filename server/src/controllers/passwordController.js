import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

import User from "../models/User.js";
import mailService from "../services/mailService.js";

const genericMessage =
  "Nếu email thuộc tài khoản đang hoạt động, liên kết đặt lại mật khẩu sẽ được gửi. Vui lòng kiểm tra cả thư rác.";

const hashToken = (token) => {
  return createHash("sha256").update(token).digest("hex");
};

const getResetOrigin = () => {
  const value = process.env.PASSWORD_RESET_ORIGIN?.trim();

  if (!value) {
    throw new Error("Chưa cấu hình PASSWORD_RESET_ORIGIN");
  }

  const url = new URL(value);

  const localDevelopment =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.protocol === "http:";

  if (
    (url.protocol !== "https:" && !localDevelopment) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("PASSWORD_RESET_ORIGIN không hợp lệ");
  }

  return url.origin;
};

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (
      typeof email !== "string" ||
      email.trim().length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        message: "Email không hợp lệ",
      });
    }

    // Luôn lấy địa chỉ frontend từ cấu hình, không dùng Host của request.
    const origin = getResetOrigin();
    const normalizedEmail = email.trim().toLowerCase();

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashToken(token);
    const now = new Date();

    // Một tài khoản chỉ nhận yêu cầu mới sau ít nhất 60 giây.
    // Điều kiện và cập nhật thực hiện trong cùng một thao tác.
    const user = await User.findOneAndUpdate(
      {
        email: normalizedEmail,
        isActive: true,
        $or: [
          { passwordResetRequestedAt: { $exists: false } },
          { passwordResetRequestedAt: null },
          {
            passwordResetRequestedAt: {
              $lte: new Date(now.getTime() - 60_000),
            },
          },
        ],
      },
      {
        $set: {
          passwordResetTokenHash: tokenHash,
          passwordResetExpiresAt: new Date(now.getTime() + 15 * 60_000),
          passwordResetRequestedAt: now,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("email");

    if (user) {
      // Fragment không được trình duyệt gửi trong HTTP request URL.
      const resetUrl = new URL("/reset-password", origin);
      resetUrl.hash = new URLSearchParams({ token }).toString();

      try {
        await mailService.sendPasswordResetEmail({
          email: user.email,
          resetUrl: resetUrl.toString(),
        });
      } catch {
        // Chỉ xóa đúng token của lần gửi bị lỗi.
        await User.updateOne(
          {
            _id: user._id,
            passwordResetTokenHash: tokenHash,
          },
          {
            $unset: {
              passwordResetTokenHash: "",
              passwordResetExpiresAt: "",
            },
          },
        );

        // Không ghi mật khẩu SMTP, token hoặc link vào log.
        console.error("Không thể gửi email đặt lại mật khẩu");
      }
    }

    return res.status(200).json({
      message: genericMessage,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(400).json({
        message: "Liên kết không hợp lệ hoặc đã hết hạn",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Mật khẩu cần ít nhất 8 ký tự và không quá 72 byte UTF-8",
      });
    }

    const tokenHash = hashToken(token);

    // Kiểm tra sơ bộ trước khi thực hiện bcrypt.
    const candidate = await User.findOne({
      isActive: true,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select("_id");

    if (!candidate) {
      return res.status(400).json({
        message: "Liên kết không hợp lệ hoặc đã hết hạn",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Kiểm tra lại hạn và tiêu thụ token cùng lúc với đổi mật khẩu.
    // Hai request đồng thời chỉ có một request được thành công.
    const updated = await User.findOneAndUpdate(
      {
        _id: candidate._id,
        isActive: true,
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { $gt: new Date() },
      },
      {
        $set: { passwordHash },
        $inc: { tokenVersion: 1 },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    ).select("_id");

    if (!updated) {
      return res.status(400).json({
        message: "Liên kết không hợp lệ hoặc đã hết hạn",
      });
    }

    return res.status(200).json({
      message: "Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại",
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  forgotPassword,
  resetPassword,
};
