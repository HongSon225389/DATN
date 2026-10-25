import express from "express";
import { rateLimit } from "express-rate-limit";

import placeController from "../controllers/placeController.js";

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Bạn tìm kiếm quá nhanh. Vui lòng thử lại sau một phút",
  },
});

router.get("/search", searchLimiter, placeController.searchPlaces);

export default router;
