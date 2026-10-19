import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

async function startServer() {
  const port = Number(process.env.PORT || 5000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT phải là số nguyên từ 1 đến 65535");
  }

  await connectDatabase();

  const server = app.listen(port, () => {
    console.log(`Backend đang chạy tại http://localhost:${port}`);
  });

  server.on("error", (error) => {
    console.error("Không thể mở HTTP server:", error.message);
    process.exit(1);
  });
}

startServer().catch((error) => {
  console.error("Không thể khởi động backend:", error.message);
  process.exit(1);
});
