import mongoose from "mongoose";

import FloodEvent from "../models/FloodEvent.js";

// Đăng ký Model để populate.
import "../models/FloodObservation.js";
import "../models/SourceArticle.js";

const observationPopulate = {
  path: "latestObservationId",
  select:
    "status observedAt observedDate timePrecision timeNote " +
    "depthMinCm depthMaxCm depthMethod note sourceArticleId",
  populate: {
    path: "sourceArticleId",
    select: "title publisher url publishedAt",
  },
};

const formatFloodEvent = (event) => {
  return {
    id: event._id,
    code: event.code,
    regionCode: event.regionCode,
    title: event.title,
    sourceLocationText: event.sourceLocationText,
    location: event.location,
    locationMethod: event.locationMethod,
    locationReviewStatus: event.locationReviewStatus,
    locationNote: event.locationNote,
    dataMode: event.dataMode,
    isPublished: event.isPublished,
    latestObservation: event.latestObservationId || null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
};

// GET /api/admin/flood-events
const getFloodEvents = async (req, res) => {
  try {
    const { mode, published } = req.query;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "page phải từ 1; limit phải từ 1 đến 100",
      });
    }

    if (mode !== undefined && !["current", "historical"].includes(mode)) {
      return res.status(400).json({
        message: "mode chỉ nhận current hoặc historical",
      });
    }

    if (published !== undefined && !["true", "false"].includes(published)) {
      return res.status(400).json({
        message: "published chỉ nhận true hoặc false",
      });
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: "Giá trị phân trang quá lớn",
      });
    }

    const filter = {};

    if (mode !== undefined) {
      filter.dataMode = mode;
    }

    if (published !== undefined) {
      filter.isPublished = published === "true";
    }

    const [events, total] = await Promise.all([
      FloodEvent.find(filter)
        .populate(observationPopulate)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FloodEvent.countDocuments(filter),
    ]);

    return res.status(200).json({
      count: events.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: events.map(formatFloodEvent),
    });
  } catch (error) {
    console.error("Lỗi Admin lấy danh sách sự kiện:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách sự kiện",
    });
  }
};

// GET /api/admin/flood-events/:id
const getFloodEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "Mã sự kiện không hợp lệ",
      });
    }

    const event = await FloodEvent.findById(id)
      .populate(observationPopulate)
      .lean();

    if (!event) {
      return res.status(404).json({
        message: "Không tìm thấy sự kiện",
      });
    }

    return res.status(200).json({
      data: formatFloodEvent(event),
    });
  } catch (error) {
    console.error("Lỗi Admin lấy chi tiết sự kiện:", error);

    return res.status(500).json({
      message: "Không thể lấy chi tiết sự kiện",
    });
  }
};

export default {
  getFloodEvents,
  getFloodEventById,
};
