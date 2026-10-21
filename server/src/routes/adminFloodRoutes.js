import express from "express";

import adminFloodController from "../controllers/adminFloodController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Mọi route phía dưới đều yêu cầu Admin.
router.use(authMiddleware.protect, authMiddleware.adminOnly);

router.get("/", adminFloodController.getFloodEvents);
router.get("/:id", adminFloodController.getFloodEventById);

export default router;
