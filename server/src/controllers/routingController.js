import routingService from "../services/routingService.js";

// Khung thí điểm bao quanh Hà Nội, không phải ranh giới hành chính.
const isValidHanoiPosition = (value) =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(
    (coordinate) =>
      typeof coordinate === "number" && Number.isFinite(coordinate),
  ) &&
  value[0] >= 105.2 &&
  value[0] <= 106.1 &&
  value[1] >= 20.5 &&
  value[1] <= 21.5;

// POST /api/routes
const findRoute = async (req, res, next) => {
  try {
    const body = req.body;

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some(
        (key) => !["start", "end", "vehicle", "avoidFloods"].includes(key),
      )
    ) {
      return res.status(400).json({
        message: "Dữ liệu yêu cầu tìm đường không hợp lệ",
      });
    }

    const { start, end, vehicle = "car", avoidFloods = true } = body;

    if (!isValidHanoiPosition(start) || !isValidHanoiPosition(end)) {
      return res.status(400).json({
        message:
          "Điểm đi và điểm đến phải là [kinh độ, vĩ độ] trong khu vực thí điểm Hà Nội",
      });
    }

    if (start[0] === end[0] && start[1] === end[1]) {
      return res.status(400).json({
        message: "Điểm đi và điểm đến không được trùng nhau",
      });
    }

    if (vehicle !== "car") {
      return res.status(400).json({
        message: "Bản review hiện hỗ trợ tìm đường ô tô",
      });
    }

    if (typeof avoidFloods !== "boolean") {
      return res.status(400).json({
        message: "avoidFloods phải là true hoặc false",
      });
    }

    const data = await routingService.findRoute({
      start,
      end,
      avoidFloods,
    });

    res.set("Cache-Control", "no-store");

    return res.status(200).json({ data });
  } catch (error) {
    if ([422, 502, 503, 504].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  }
};

export default {
  findRoute,
};
