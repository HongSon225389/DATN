import mongoose from "mongoose";
import FloodEvent from "../models/FloodEvent.js";

// Đăng ký các Model được populate.
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

// Chuyển document thành dữ liệu trả cho frontend.
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

// GET /api/flood-events
const getFloodEvents = async (req, res) => {
  try {
    const mode = req.query.mode || "current";

    if (!["current", "historical"].includes(mode)) {
      return res.status(400).json({
        message: "mode chỉ nhận current hoặc historical",
      });
    }

    const events = await FloodEvent.find({
      regionCode: "HN",
      dataMode: mode,
      isPublished: true,
    })
      .populate(observationPopulate)
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      count: events.length,
      data: events.map(formatFloodEvent),
    });
  } catch (error) {
    console.error("Lỗi lấy danh sách ngập:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách thông tin ngập",
    });
  }
};

// GET /api/flood-events/:id
const getFloodEventById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "Mã sự kiện không hợp lệ",
      });
    }

    const event = await FloodEvent.findOne({
      _id: id,
      regionCode: "HN",
      isPublished: true,
    })
      .populate(observationPopulate)
      .lean();

    if (!event) {
      return res.status(404).json({
        message: "Không tìm thấy sự kiện đã công bố",
      });
    }

    return res.status(200).json({
      data: formatFloodEvent(event),
    });
  } catch (error) {
    console.error("Lỗi lấy chi tiết ngập:", error);

    return res.status(500).json({
      message: "Không thể lấy chi tiết thông tin ngập",
    });
  }
};

// GET /api/dev/flood-events
// Chỉ dùng kiểm tra dữ liệu khảo sát trong development.
const getSurveyFloodEvents = async (req, res) => {
  try {
    const events = await FloodEvent.find({
      code: {
        $in: [
          "HN-20250930-KS01",
          "HN-20250930-KS02",
          "HN-20250930-KS03",
          "HN-20250930-KS04",
          "HN-20250930-KS05",
        ],
      },
      dataMode: "historical",
    })
      .populate(observationPopulate)
      .sort({ code: 1 })
      .lean();

    return res.status(200).json({
      purpose: "development-survey",
      message:
        "Dữ liệu lịch sử khảo sát, có thể chưa công bố. Không dùng cho định tuyến hiện tại.",
      count: events.length,
      data: events.map(formatFloodEvent),
    });
  } catch (error) {
    console.error("Lỗi đọc dữ liệu khảo sát:", error);

    return res.status(500).json({
      message: "Không thể đọc dữ liệu khảo sát",
    });
  }
};

export default {
  getFloodEvents,
  getFloodEventById,
  getSurveyFloodEvents,
};
