import dotenv from "dotenv";
import { mkdir, writeFile } from "node:fs/promises";

// Đọc đúng server/.env, không phụ thuộc thư mục chạy lệnh.
dotenv.config({
  path: new URL("../.env", import.meta.url),
  quiet: true,
});

async function main() {
  const apiKey = process.env.ORS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Chưa khai báo ORS_API_KEY trong server/.env");
  }

  const baseUrl = (
    process.env.ORS_BASE_URL || "https://api.heigit.org/openrouteservice"
  ).replace(/\/+$/, "");

  const endpoint = `${baseUrl}/v2/directions/driving-car/geojson`;

  // Điểm thử tại Hà Nội: [kinh độ, vĩ độ].
  const requestBody = {
    coordinates: [
      [105.85, 21.02],
      [105.843, 21.009],
    ],
    preference: "shortest",
  };

  console.log("Đang thử định tuyến ô tô tại Hà Nội…");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const hints = {
      401: "Kiểm tra API key.",
      403: "Kiểm tra API key và quyền sử dụng Directions.",
      404: "Kiểm tra địa chỉ endpoint.",
      429: "Đã vượt hạn mức hoặc tốc độ gọi API.",
    };

    throw new Error(
      `API trả HTTP ${response.status}. ${
        hints[response.status] || "Cần kiểm tra phản hồi dịch vụ."
      }`,
    );
  }

  const data = await response.json();
  const feature = data.features?.[0];
  const summary = feature?.properties?.summary;

  if (
    feature?.geometry?.type !== "LineString" ||
    !feature.geometry.coordinates?.length ||
    !summary
  ) {
    throw new Error("Phản hồi không có tuyến GeoJSON như mong đợi.");
  }

  const outputDirectory = new URL("../tmp/", import.meta.url);

  await mkdir(outputDirectory, { recursive: true });

  await writeFile(
    new URL("route-normal.geojson", outputDirectory),
    JSON.stringify(data, null, 2),
    "utf8",
  );

  console.log("Thành công: nhận được tuyến thật từ API.");

  console.table({
    "Quãng đường (km)": (summary.distance / 1000).toFixed(2),
    "Thời gian ước tính (phút)": (summary.duration / 60).toFixed(1),
    "Số điểm hình học": feature.geometry.coordinates.length,
  });

  console.log("Đã lưu: server/tmp/route-normal.geojson");
  console.log("Đây là tuyến thường, chưa áp dụng vùng tránh ngập.");
}

main().catch((error) => {
  console.error("Thử định tuyến thất bại:", error.message);
  process.exitCode = 1;
});
