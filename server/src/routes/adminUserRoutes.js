import express from "express";

import authMiddleware from "../middlewares/authMiddleware.js";
import adminUserController from "../controllers/adminUserController.js";

const router = express.Router();

router.use(authMiddleware.protect, authMiddleware.adminOnly);

router.get("/", adminUserController.getUsers);
router.get("/:id/reports", adminUserController.getUserReports);
router.patch("/:id/status", adminUserController.updateUserStatus);

export default router;
