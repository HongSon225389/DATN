import dotenv from "dotenv";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import tokenUtils from "./utils/token.js";
dotenv.config({
  path: new URL("../.env", import.meta.url),
});

const startServer = async () => {
  try {
    const port = Number(process.env.PORT || 5000);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("PORT phải là số nguyên từ 1 đến 65535");
    }

    // Kiểm tra secret trước khi mở server.
    tokenUtils.generateToken(new User()._id);

    await connectDB();

    // Đợi unique index của email sẵn sàng.
    await User.init();

    // Nạp app sau khi đã đọc biến môi trường.
    const { default: app } = await import("./app.js");

    const server = app.listen(port, () => {
      console.log(`Backend đang chạy tại http://localhost:${port}`);
    });

    server.on("error", (error) => {
      console.error("Không thể mở HTTP server:", error.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("Không thể khởi động backend:", error.message);
    process.exit(1);
  }
};

startServer();
