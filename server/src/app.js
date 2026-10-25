import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/healthRoutes.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import floodRoutes from "./routes/floodRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import adminFloodRoutes from "./routes/adminFloodRoutes.js";
import placeRoutes from "./routes/placeRoutes.js";
import floodReportRoutes from "./routes/floodReportRoutes.js";
import adminFloodReportRoutes from "./routes/adminFloodReportRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import routingRoutes from "./routes/routingRoutes.js";
import adminAvoidanceRoutes from "./routes/adminAvoidanceRoutes.js";

const app = express();

// Cấu hình chung.
app.disable("x-powered-by");

// Middleware.
app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Routes.
// API công khai.
app.use("/api/health", healthRoutes);
app.use("/api/flood-events", floodRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin/flood-events", adminFloodRoutes);

// Chỉ mở API khảo sát khi cấu hình rõ development.
if (process.env.NODE_ENV === "development") {
  app.use("/api/dev", devRoutes);
}
app.use("/api/places", placeRoutes);
app.use("/api/flood-reports", floodReportRoutes);
app.use("/api/admin/flood-reports", adminFloodReportRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/routes", routingRoutes);
app.use("/api/admin/routing-avoidances", adminAvoidanceRoutes);

// Xử lý đường dẫn không tồn tại và lỗi.
// Phải đặt sau các routes.
app.use(errorMiddleware.notFound);
app.use(errorMiddleware.errorHandler);

export default app;
