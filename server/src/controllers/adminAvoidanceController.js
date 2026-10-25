import mongoose from "mongoose";
import {
  area,
  booleanValid,
  distance,
  kinks,
  point,
  polygon,
} from "@turf/turf";

import FloodEvent from "../models/FloodEvent.js";
import FloodObservation from "../models/FloodObservation.js";
import RoutingAvoidance from "../models/RoutingAvoidance.js";

const fail = (status, message) => {
  const error = new Error(message);
  error.status = status;
  throw error;
};

const getAreas = async (req, res, next) => {
  try {
    const { eventId } = req.query;

    if (!mongoose.isObjectIdOrHexString(eventId)) {
      return res.status(400).json({
        message: "Mã điểm ngập không hợp lệ",
      });
    }

    const data = await RoutingAvoidance.find({
      floodEventId: eventId,
      endedAt: null,
    })
      .select("title geometry isActive validFrom reviewAt reason revision")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.set("Cache-Control", "no-store");

    return res.json({
      data: data.map((item) => ({
        id: item._id,
        title: item.title,
        geometry: item.geometry,
        isActive: item.isActive,
        validFrom: item.validFrom,
        reviewAt: item.reviewAt,
        reason: item.reason,
        revision: item.revision,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const createArea = async (req, res, next) => {
  let session;

  try {
    const { floodEventId, eventRevision, vertices, hours, reason } =
      req.body || {};

    if (
      !mongoose.isObjectIdOrHexString(floodEventId) ||
      !Number.isInteger(eventRevision) ||
      eventRevision < 0
    ) {
      fail(400, "Điểm ngập hoặc phiên bản không hợp lệ");
    }

    if (!Number.isInteger(hours) || hours < 1 || hours > 48) {
      fail(400, "Thời hạn áp dụng từ 1 đến 48 giờ");
    }

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 1000
    ) {
      fail(400, "Cần nhập căn cứ xác định vùng, tối đa 1000 ký tự");
    }

    if (
      !Array.isArray(vertices) ||
      vertices.length < 3 ||
      vertices.length > 100 ||
      !vertices.every(
        (position) =>
          Array.isArray(position) &&
          position.length === 2 &&
          position.every(Number.isFinite) &&
          position[0] >= 105.2 &&
          position[0] <= 106.1 &&
          position[1] >= 20.5 &&
          position[1] <= 21.5,
      )
    ) {
      fail(400, "Vùng cần từ 3 đến 100 đỉnh trong khu vực thí điểm");
    }

    if (
      new Set(vertices.map((position) => position.join(","))).size !==
      vertices.length
    ) {
      fail(400, "Các đỉnh không được trùng nhau");
    }

    const shape = polygon([[...vertices, [...vertices[0]]]]);

    if (!booleanValid(shape) || kinks(shape).features.length > 0) {
      fail(400, "Vùng không hợp lệ hoặc có cạnh tự cắt");
    }

    const squareMeters = area(shape);

    // Giới hạn riêng của bản thử để tránh vẽ nhầm một vùng quá lớn.
    if (squareMeters < 2 || squareMeters > 100_000) {
      fail(400, "Diện tích vùng thử phải từ 2 đến 100.000 m²");
    }

    session = await mongoose.startSession();
    let saved;

    await session.withTransaction(async () => {
      const event = await FloodEvent.findOne({
        _id: floodEventId,
        regionCode: "HN",
        dataMode: "current",
        isPublished: true,
        isDeleted: { $ne: true },
        publishedAt: { $type: "date", $lte: new Date() },
      }).session(session);

      if (!event) {
        fail(404, "Không tìm thấy điểm ngập hiện tại đã công bố");
      }

      if (event.revision !== eventRevision) {
        fail(409, "Điểm ngập đã thay đổi. Vui lòng tìm và chọn lại");
      }

      const observation = await FloodObservation.findOne({
        _id: event.latestObservationId,
        floodEventId: event._id,
        status: "flooded",
        publishedAt: { $type: "date", $lte: new Date() },
      }).session(session);

      if (!observation) {
        fail(409, "Chỉ tạo vùng tránh cho điểm hiện đang ngập");
      }

      const eventPoint = point(event.location.coordinates);

      if (
        vertices.some(
          (position) =>
            distance(eventPoint, point(position), {
              units: "kilometers",
            }) > 1,
        )
      ) {
        fail(400, "Vùng thử phải nằm trong phạm vi 1 km quanh điểm ngập");
      }

      const now = new Date();

      const region = new RoutingAvoidance({
        floodEventId: event._id,
        title: event.title,
        geometry: shape.geometry,
        vehicleTypes: ["car"],
        isActive: true,
        validFrom: now,
        reviewAt: new Date(now.getTime() + hours * 60 * 60 * 1000),
        reason: reason.trim(),
        createdBy: req.user._id,
        updatedBy: req.user._id,
      });

      await region.save({ session });

      // Ghi vào sự kiện để phát hiện cập nhật đồng thời:
      // admin khác đổi trạng thái/xóa điểm trong lúc tạo vùng.
      event.updatedBy = req.user._id;
      event.markModified("updatedBy");
      await event.save({ session });

      saved = {
        id: region._id,
        reviewAt: region.reviewAt,
      };
    });

    return res.status(201).json({
      message: "Đã tạo và bật vùng tránh",
      data: saved,
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Điểm ngập đã thay đổi. Vui lòng chọn lại",
      });
    }

    if ([400, 404, 409].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  } finally {
    if (session) await session.endSession();
  }
};

const endArea = async (req, res, next) => {
  try {
    const { revision } = req.body || {};

    if (
      !mongoose.isObjectIdOrHexString(req.params.id) ||
      !Number.isInteger(revision) ||
      revision < 0
    ) {
      return res.status(400).json({
        message: "Mã vùng hoặc phiên bản không hợp lệ",
      });
    }

    const region = await RoutingAvoidance.findOne({
      _id: req.params.id,
      endedAt: null,
    });

    if (!region) {
      return res.status(404).json({
        message: "Không tìm thấy vùng chưa kết thúc",
      });
    }

    if (region.revision !== revision) {
      return res.status(409).json({
        message: "Vùng đã thay đổi. Vui lòng tải lại",
      });
    }

    region.isActive = false;
    region.endedAt = new Date();
    region.endedBy = req.user._id;
    region.endedReason = "Admin kết thúc áp dụng trên trang quản lý";
    region.updatedBy = req.user._id;

    await region.save();

    return res.json({
      message: "Đã kết thúc vùng tránh",
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Vùng đã thay đổi. Vui lòng tải lại",
      });
    }

    return next(error);
  }
};

export default {
  getAreas,
  createArea,
  endArea,
};
