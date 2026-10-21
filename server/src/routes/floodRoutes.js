import express from "express";
import floodController from "../controllers/floodController.js";

const router = express.Router();

router.get("/", floodController.getFloodEvents);
router.get("/:id", floodController.getFloodEventById);

export default router;
