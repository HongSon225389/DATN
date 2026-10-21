import express from "express";
import floodController from "../controllers/floodController.js";

const router = express.Router();

router.get("/flood-events", floodController.getSurveyFloodEvents);

export default router;
