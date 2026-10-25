import FloodEvent from "../models/FloodEvent.js";
import FloodObservation from "../models/FloodObservation.js";
import RoutingAvoidance from "../models/RoutingAvoidance.js";
import {
  booleanIntersects,
  booleanPointInPolygon,
  lineString,
  point,
} from "@turf/turf";

const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

// Chỉ sử dụng vùng được bật, còn hạn và thuộc điểm hiện tại đang ngập.
const getActiveAvoidances = async () => {
  const now = new Date();

  return RoutingAvoidance.aggregate([
    {
      $match: {
        isActive: true,
        endedAt: null,
        vehicleTypes: "car",
        validFrom: { $lte: now },
        reviewAt: { $gt: now },
      },
    },
    {
      $lookup: {
        from: FloodEvent.collection.name,
        localField: "floodEventId",
        foreignField: "_id",
        as: "event",
      },
    },
    { $unwind: "$event" },
    {
      $match: {
        "event.regionCode": "HN",
        "event.dataMode": "current",
        "event.isPublished": true,
        "event.isDeleted": { $ne: true },
        "event.publishedAt": { $type: "date", $lte: now },
      },
    },
    {
      $lookup: {
        from: FloodObservation.collection.name,
        let: {
          observationId: "$event.latestObservationId",
          eventId: "$event._id",
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$_id", "$$observationId"] },
                  { $eq: ["$floodEventId", "$$eventId"] },
                ],
              },
              status: "flooded",
              publishedAt: { $type: "date", $lte: now },
            },
          },
        ],
        as: "observation",
      },
    },
    { $unwind: "$observation" },
    {
      $project: {
        _id: 1,
        geometry: 1,
      },
    },
    // Giới hạn riêng của bản review, không âm thầm bỏ bớt vùng.
    { $limit: 21 },
  ]);
};

const findRoute = async ({ start, end, avoidFloods }) => {
  const apiKey = process.env.ORS_API_KEY?.trim();

  if (!apiKey) {
    fail(503, "Chưa cấu hình ORS_API_KEY trên backend");
  }

  const areas = avoidFloods ? await getActiveAvoidances() : [];

  if (areas.length > 20) {
    fail(
      503,
      "Số vùng tránh vượt giới hạn của bản review. Cần rà soát cấu hình định tuyến",
    );
  }
  for (const area of areas) {
    if (booleanPointInPolygon(point(start), area.geometry)) {
      fail(
        422,
        "Điểm đi nằm trong vùng tránh ngập. Hãy chọn vị trí tiếp cận khác.",
      );
    }

    if (booleanPointInPolygon(point(end), area.geometry)) {
      fail(
        422,
        "Điểm đến nằm trong vùng tránh ngập. Hãy chọn vị trí tiếp cận khác.",
      );
    }
  }
  const body = {
    coordinates: [start, end],
    preference: "recommended",
    instructions: false,

    // Giới hạn khoảng tìm đường tiếp cận điểm đi/đến.
    radiuses: [150, 150],
  };

  if (areas.length > 0) {
    body.options = {
      avoid_polygons: {
        type: "MultiPolygon",
        coordinates: areas.map((area) => area.geometry.coordinates),
      },
    };
  }

  let response;

  try {
    response = await fetch(
      "https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
          Accept: "application/geo+json, application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      },
    );
  } catch (error) {
    fail(
      error.name === "TimeoutError" ? 504 : 502,
      error.name === "TimeoutError"
        ? "Tìm đường quá thời gian. Vui lòng thử lại"
        : "Không kết nối được dịch vụ tìm đường",
    );
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const code = result?.error?.code;

    // Không ghi API key hoặc toàn bộ request vào log.
    console.error(
      "ORS routing:",
      response.status,
      code,
      result?.error?.message,
    );

    if (response.status === 429) {
      fail(503, "Dịch vụ tìm đường đang giới hạn yêu cầu. Thử lại sau");
    }

    if (response.status === 401 || response.status === 403) {
      fail(503, "Dịch vụ tìm đường chưa được cấu hình hợp lệ");
    }

    if (code === 2010) {
      fail(
        422,
        "Không tìm thấy đường ô tô phù hợp trong phạm vi 150 m quanh điểm đi hoặc điểm đến. Hãy chọn lại vị trí sát đường ô tô.",
      );
    }

    if (code === 2009) {
      fail(422, "Không tìm được tuyến ô tô nối hai vị trí đã chọn.");
    }

    fail(502, "Dịch vụ chưa tìm được tuyến cho yêu cầu này");
  }

  const feature = result?.features?.[0];
  const geometry = feature?.geometry;
  const summary = feature?.properties?.summary;

  if (
    geometry?.type !== "LineString" ||
    !Array.isArray(geometry.coordinates) ||
    geometry.coordinates.length < 2 ||
    !geometry.coordinates.every(
      (position) =>
        Array.isArray(position) &&
        position.length >= 2 &&
        Number.isFinite(position[0]) &&
        Number.isFinite(position[1]) &&
        position[0] >= -180 &&
        position[0] <= 180 &&
        position[1] >= -90 &&
        position[1] <= 90,
    ) ||
    !Number.isFinite(summary?.distance) ||
    summary.distance < 0 ||
    !Number.isFinite(summary?.duration) ||
    summary.duration < 0
  ) {
    fail(502, "Dịch vụ trả dữ liệu tuyến không hợp lệ");
  }
  const routeCoordinates = geometry.coordinates.map(([lng, lat]) => [lng, lat]);

  const routeLine = lineString(routeCoordinates);

  // Đây là đoạn nối hình học để kiểm tra bảo thủ,
  // không phải một đoạn đường đã được định tuyến.
  const startConnector = lineString([start, routeCoordinates[0]]);

  const endConnector = lineString([
    routeCoordinates[routeCoordinates.length - 1],
    end,
  ]);

  for (const area of areas) {
    if (booleanIntersects(routeLine, area.geometry)) {
      fail(
        422,
        "Tuyến trả về vẫn giao vùng tránh ngập. Chưa thể cung cấp tuyến này.",
      );
    }

    if (
      booleanIntersects(startConnector, area.geometry) ||
      booleanIntersects(endConnector, area.geometry)
    ) {
      fail(
        422,
        "Đoạn nối từ địa chỉ tới đường ô tô giao vùng tránh ngập. Hãy chọn lại điểm tiếp cận.",
      );
    }
  }
  return {
    provider: "openrouteservice",
    vehicle: "car",
    preference: "recommended",
    distanceMeters: summary.distance,
    durationSeconds: summary.duration,
    geometry,
    avoidance: {
      requested: avoidFloods,
      applied: areas.length > 0,
      areaCount: areas.length,
    },
    warnings: [
      "Thời gian di chuyển là ước tính, không phản ánh giao thông trực tiếp.",
      ...(avoidFloods && areas.length === 0
        ? [
            "Chưa có vùng tránh ngập đủ điều kiện. Tuyến này chưa áp dụng tránh ngập.",
          ]
        : []),
      ...(areas.length > 0
        ? [
            "Tuyến áp dụng các vùng tránh đã cấu hình; dữ liệu ngập có thể chưa đầy đủ.",
          ]
        : []),
    ],
    calculatedAt: new Date().toISOString(),
    avoidanceAreas: areas.map((area) => ({
      id: area._id.toString(),
      geometry: area.geometry,
    })),
  };
};

export default {
  findRoute,
};
