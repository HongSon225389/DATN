import mongoose from "mongoose";

import FloodEvent from "../models/FloodEvent.js";
import FloodObservation from "../models/FloodObservation.js";

const RECEDED_VISIBLE_MS = 24 * 60 * 60 * 1000;

const buildPublicPipeline = ({ mode, id, now }) => {
  const filter = {
    regionCode: "HN",
    isPublished: true,
    isDeleted: { $ne: true },
    publishedAt: {
      $type: "date",
      $lte: now,
    },
  };

  if (mode) {
    filter.dataMode = mode;
  }

  if (id) {
    filter._id = new mongoose.Types.ObjectId(id);
  }

  const cutoff = new Date(now.getTime() - RECEDED_VISIBLE_MS);

  return [
    {
      $match: filter,
    },

    // Lấy đúng bản ghi tình trạng mới nhất của chính điểm này.
    {
      $lookup: {
        from: FloodObservation.collection.name,
        let: {
          observationId: "$latestObservationId",
          eventId: "$_id",
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
              publishedAt: {
                $type: "date",
                $lte: now,
              },
            },
          },
          {
            $project: {
              status: 1,
              trend: 1,
              depthMinCm: 1,
              depthMaxCm: 1,
              publishedAt: 1,
            },
          },
        ],
        as: "publicObservation",
      },
    },

    {
      $unwind: "$publicObservation",
    },

    {
      $match: {
        $or: [
          // Dữ liệu lịch sử không áp dụng thời hạn 24 giờ.
          {
            dataMode: "historical",
            "publicObservation.status": {
              $in: ["flooded", "receded"],
            },
          },

          // Điểm hiện tại vẫn đang ngập thì tiếp tục hiển thị.
          {
            dataMode: "current",
            "publicObservation.status": "flooded",
          },

          // Đã rút chỉ hiển thị trong 24 giờ sau lần công bố này.
          {
            dataMode: "current",
            "publicObservation.status": "receded",
            "publicObservation.publishedAt": {
              $gt: cutoff,
            },
          },
        ],
      },
    },

    {
      $sort: {
        lastStatusPublishedAt: -1,
        _id: -1,
      },
    },

    {
      $project: {
        code: 1,
        regionCode: 1,
        title: 1,
        address: 1,
        location: 1,
        dataMode: 1,
        publishedAt: 1,
        lastStatusPublishedAt: 1,
        publicObservation: 1,
      },
    },
  ];
};

const formatFloodEvent = (event) => {
  const observation = event.publicObservation;

  return {
    id: event._id,
    code: event.code,
    regionCode: event.regionCode,
    title: event.title,
    address: event.address ?? null,
    location: event.location,
    dataMode: event.dataMode,

    publishedAt: event.publishedAt,
    lastStatusPublishedAt: event.lastStatusPublishedAt,

    latestObservation: {
      status: observation.status,
      trend: observation.trend ?? "unknown",
      depthMinCm: observation.depthMinCm ?? null,
      depthMaxCm: observation.depthMaxCm ?? null,
      publishedAt: observation.publishedAt,
    },
  };
};

// GET /api/flood-events
const getFloodEvents = async (req, res, next) => {
  try {
    const mode = req.query.mode ?? "current";

    if (typeof mode !== "string" || !["current", "historical"].includes(mode)) {
      return res.status(400).json({
        message: "mode chỉ nhận current hoặc historical",
      });
    }

    const events = await FloodEvent.aggregate([
      ...buildPublicPipeline({
        mode,
        now: new Date(),
      }),
      { $limit: 101 },
    ]);

    // Kết quả thay đổi theo thời gian kể cả khi database không đổi.
    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      count: Math.min(events.length, 100),
      truncated: events.length > 100,
      data: events.slice(0, 100).map(formatFloodEvent),
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/flood-events/:id
const getFloodEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    const [event] = await FloodEvent.aggregate([
      ...buildPublicPipeline({
        id,
        now: new Date(),
      }),
      { $limit: 1 },
    ]);

    res.set("Cache-Control", "no-store");

    if (!event) {
      return res.status(404).json({
        message: "Địa điểm không còn hiển thị hoặc chưa được công bố",
      });
    }

    return res.status(200).json({
      data: formatFloodEvent(event),
    });
  } catch (error) {
    return next(error);
  }
};

// Giữ để route development cũ không gây lỗi khởi động.
const getSurveyFloodEvents = (req, res) => {
  return res.status(410).json({
    message: "API khảo sát cũ đã ngừng sử dụng",
  });
};

export default {
  getFloodEvents,
  getFloodEventById,
  getSurveyFloodEvents,
};
