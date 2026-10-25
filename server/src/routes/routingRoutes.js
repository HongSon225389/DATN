import express from "express";
import { rateLimit } from "express-rate-limit";

import routingController from "../controllers/routingController.js";

const router = express.Router();

const routingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message: "Tối đa 10 yêu cầu tìm đường mỗi phút. Vui lòng thử lại sau",
  },
});

// Khách cũng được tìm đường.
router.post("/", routingLimiter, routingController.findRoute);

export default router;
