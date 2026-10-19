import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoose from "mongoose";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "hanoi-flood-routing-api",
    database:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: "API không tồn tại",
  });
});

app.use((error, req, res, next) => {
  console.error(error);

  const status =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;

  res.status(status).json({
    message:
      status === 400
        ? "Dữ liệu gửi lên không hợp lệ"
        : "Có lỗi xảy ra khi xử lý yêu cầu",
  });
});

export default app;
