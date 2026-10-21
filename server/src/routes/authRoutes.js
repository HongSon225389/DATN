import express from "express";

import authController from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", authController.registerUser);
router.post("/login", authController.loginUser);

router.get("/me", authMiddleware.protect, authController.getCurrentUser);

router.get(
  "/admin-check",
  authMiddleware.protect,
  authMiddleware.adminOnly,
  authController.checkAdmin,
);

export default router;
