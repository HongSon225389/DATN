import express from "express";

import adminFloodController from "../controllers/adminFloodController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(authMiddleware.protect, authMiddleware.adminOnly);
router.get("/:id/observations", adminFloodController.getFloodObservations);
router.post("/:id/observations", adminFloodController.addFloodObservation);

router.post("/", adminFloodController.createFloodEvent);
router.get("/", adminFloodController.getFloodEvents);

router.patch("/:id/draft", adminFloodController.updateFloodEventDraft);
router.post("/:id/publish", adminFloodController.publishFloodEvent);

router.get("/:id", adminFloodController.getFloodEventById);
router.delete("/:id", adminFloodController.deleteFloodEvent);
export default router;
