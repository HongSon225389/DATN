import mongoose from "mongoose";

// GET /api/health
const getHealth = (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  return res.status(200).json({
    status: "ok",
    service: "hanoi-flood-routing-api",
    database: isDatabaseConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
};

export default {
  getHealth,
};
