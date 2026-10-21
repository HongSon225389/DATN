import mongoose from "mongoose";

import User from "../models/User.js";
import tokenUtils from "../utils/token.js";

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;

  const match =
    typeof authorization === "string"
      ? authorization.match(/^Bearer\s+(\S+)$/i)
      : null;

  if (!match) {
    return res.status(401).json({
      message: "Bạn cần đăng nhập",
    });
  }

  let payload;

  try {
    payload = tokenUtils.verifyToken(match[1]);
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Phiên đăng nhập hết hạn hoặc không hợp lệ",
      });
    }

    return next(error);
  }

  if (
    typeof payload !== "object" ||
    !mongoose.isObjectIdOrHexString(payload.sub)
  ) {
    return res.status(401).json({
      message: "Token không hợp lệ",
    });
  }

  try {
    const user = await User.findById(payload.sub);

    if (!user || !user.isActive) {
      return res.status(401).json({
        message: "Tài khoản không khả dụng",
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Bạn cần đăng nhập",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện thao tác này",
    });
  }

  return next();
};

export default {
  protect,
  adminOnly,
};
