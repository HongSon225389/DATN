import express from "express";

import authMiddleware from "../middlewares/authMiddleware.js";
import controller from "../controllers/adminAvoidanceController.js";

const router = express.Router();

router.use(authMiddleware.protect, authMiddleware.adminOnly);

router.get("/", controller.getAreas);
router.post("/", controller.createArea);
router.post("/:id/end", controller.endArea);

export default router;
