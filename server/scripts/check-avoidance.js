import dotenv from "dotenv";
import { readFile, writeFile } from "node:fs/promises";
import { along, length, buffer, point, booleanDisjoint } from "@turf/turf";

dotenv.config({
  path: new URL("../.env", import.meta.url),
  quiet: true,
});

async function main() {
  const apiKey = process.env.ORS_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Chưa khai báo ORS_API_KEY trong server/.env");
  }

  const directory = new URL("../tmp/", import.meta.url);

  const normalData = JSON.parse(
    await readFile(new URL("route-normal.geojson", directory), "utf8"),
  );

  const normalRoute = normalData.features?.[0];

  if (normalRoute?.geometry?.type !== "LineString") {
    throw new Error("File tuyến thường không có LineString hợp lệ.");
  }

  const coordinates = normalRoute.geometry.coordinates;
  const start = coordinates[0];
  const end = coordinates[coordinates.length - 1];

  // Lấy vị trí giữa tuyến theo chiều dài hình học.
  const distanceKm = length(normalRoute, {
    units: "kilometers",
  });

  const midpoint = along(normalRoute, distanceKm / 2, {
    units: "kilometers",
  });

  // Bán kính 50 m chỉ dùng thử kỹ thuật, không phải ngưỡng ngập.
  const avoidance = buffer(midpoint, 50, {
    units: "meters",
  });

  if (!avoidance) {
    throw new Error("Không tạo được polygon thử.");
  }

  avoidance.properties = {
    name: "Vùng tránh giả lập",
    purpose: "technical-test",
    radiusMeters: 50,
  };

  // Đảm bảo bài thử có ý nghĩa.
  if (booleanDisjoint(normalRoute, avoidance)) {
    throw new Error("Tuyến thường không giao vùng thử.");
  }

  if (
    !booleanDisjoint(point(start), avoidance) ||
    !booleanDisjoint(point(end), avoidance)
  ) {
    throw new Error("Vùng thử chứa điểm đầu hoặc cuối. Cần đổi bài thử.");
  }

  await writeFile(
    new URL("avoidance-test.geojson", directory),
    JSON.stringify(avoidance, null, 2),
    "utf8",
  );

  const baseUrl = (
    process.env.ORS_BASE_URL || "https://api.heigit.org/openrouteservice"
  ).replace(/\/+$/, "");

  console.log("Đang tính lại tuyến với vùng tránh giả lập 50 m…");

  const response = await fetch(`${baseUrl}/v2/directions/driving-car/geojson`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
      Accept: "application/geo+json, application/json",
    },
    body: JSON.stringify({
      // Dùng hai đầu của hình học tuyến cũ để so sánh.
      coordinates: [start, end],
      preference: "shortest",
      options: {
        avoid_polygons: avoidance.geometry,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `API trả HTTP ${response.status}. Chưa thể kết luận bài thử đạt.`,
    );
  }

  const avoidedData = await response.json();
  const avoidedRoute = avoidedData.features?.[0];

  if (avoidedRoute?.geometry?.type !== "LineString") {
    throw new Error("Không nhận được tuyến GeoJSON hợp lệ.");
  }

  await writeFile(
    new URL("route-avoidance.geojson", directory),
    JSON.stringify(avoidedData, null, 2),
    "utf8",
  );

  const normalSummary = normalRoute.properties?.summary;
  const avoidedSummary = avoidedRoute.properties?.summary;

  if (!normalSummary || !avoidedSummary) {
    throw new Error("Phản hồi thiếu thông tin quãng đường/thời gian.");
  }

  const passed = booleanDisjoint(avoidedRoute, avoidance);

  console.table([
    {
      "Loại tuyến": "Tuyến thường",
      "Quãng đường (km)": (normalSummary.distance / 1000).toFixed(2),
      "Thời gian (phút)": (normalSummary.duration / 60).toFixed(1),
      "Giao vùng thử": "Có",
    },
    {
      "Loại tuyến": "Tuyến có vùng tránh",
      "Quãng đường (km)": (avoidedSummary.distance / 1000).toFixed(2),
      "Thời gian (phút)": (avoidedSummary.duration / 60).toFixed(1),
      "Giao vùng thử": passed ? "Không" : "Có",
    },
  ]);

  if (!passed) {
    throw new Error(
      "CHƯA ĐẠT: hình học tuyến mới vẫn giao hoặc chạm vùng thử.",
    );
  }

  console.log("ĐẠT: tuyến thường giao vùng thử, tuyến mới không giao.");
  console.log("Đã lưu polygon và tuyến mới trong server/tmp/.");
  console.log(
    "Kết quả chỉ kiểm chứng bài thử này, chưa chứng minh khả năng tránh ngập thực tế.",
  );
}

main().catch((error) => {
  console.error("Thử vùng tránh thất bại:", error.message);
  process.exitCode = 1;
});
