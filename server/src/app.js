import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import healthRoutes from "./routes/healthRoutes.js";
import errorMiddleware from "./middlewares/errorMiddleware.js";

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
app.use("/api/health", healthRoutes);

// Xử lý đường dẫn không tồn tại và lỗi.
// Phải đặt sau các routes.
app.use(errorMiddleware.notFound);
app.use(errorMiddleware.errorHandler);

export default app;
