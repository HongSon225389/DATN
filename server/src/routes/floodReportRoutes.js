import express from "express";
import { rateLimit } from "express-rate-limit";

import authMiddleware from "../middlewares/authMiddleware.js";
import reportUploadMiddleware from "../middlewares/reportUploadMiddleware.js";
import floodReportController from "../controllers/floodReportController.js";

const router = express.Router();

const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  keyGenerator: (req) => req.user._id.toString(),
  skipFailedRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Tối đa 3 lần gửi trong 15 phút. Vui lòng thử lại sau",
  },
});

const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Có quá nhiều yêu cầu từ kết nối này. Vui lòng thử lại sau",
  },
});
const userOnly = (req, res, next) => {
  if (req.user.role !== "user") {
    return res.status(403).json({
      message: "Chức năng gửi báo cáo dành cho tài khoản người dùng",
    });
  }

  return next();
};

router.post(
  "/",
  authMiddleware.protect,
  userOnly,
  ipLimiter,
  accountLimiter,
  reportUploadMiddleware.receiveReportImages,
  floodReportController.createFloodReport,
);

router.get(
  "/mine",
  authMiddleware.protect,
  userOnly,
  floodReportController.getMyReports,
);

router.get("/:id", authMiddleware.protect, floodReportController.getReportById);

router.get(
  "/:id/images/:index",
  authMiddleware.protect,
  floodReportController.getReportImage,
);
router.post(
  "/:id/resubmit",
  authMiddleware.protect,
  userOnly,
  ipLimiter,
  accountLimiter,
  reportUploadMiddleware.receiveReportImages,
  floodReportController.createFloodReport,
);
export default router;
