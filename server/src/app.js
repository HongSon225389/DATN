import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/healthRoutes.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";
import floodRoutes from "./routes/floodRoutes.js";
import devRoutes from "./routes/devRoutes.js";
import authRoutes from "./routes/authRoutes.js";

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

// Chỉ mở API khảo sát khi cấu hình rõ development.
if (process.env.NODE_ENV === "development") {
  app.use("/api/dev", devRoutes);
}

// Xử lý đường dẫn không tồn tại và lỗi.
// Phải đặt sau các routes.
app.use(errorMiddleware.notFound);
app.use(errorMiddleware.errorHandler);

export default app;
