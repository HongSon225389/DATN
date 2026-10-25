import express from "express";

import floodReportController from "../controllers/floodReportController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware.protect, authMiddleware.adminOnly);

router.get("/", floodReportController.getAdminReports);

router.post("/:id/reject", floodReportController.rejectReport);

router.post("/:id/approve", floodReportController.approveReport);

export default router;
