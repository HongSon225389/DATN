import express from "express";
import { rateLimit } from "express-rate-limit";

import authController from "../controllers/authController.js";
import passwordController from "../controllers/passwordController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Bạn đã gửi nhiều yêu cầu. Vui lòng thử lại sau 15 phút",
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút",
  },
});

router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  passwordController.forgotPassword,
);

router.post(
  "/reset-password",
  resetPasswordLimiter,
  passwordController.resetPassword,
);

router.get("/me", authMiddleware.protect, authController.getCurrentUser);

router.get(
  "/admin-check",
  authMiddleware.protect,
  authMiddleware.adminOnly,
  authController.checkAdmin,
);

export default router;
