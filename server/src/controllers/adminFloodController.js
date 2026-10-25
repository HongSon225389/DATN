import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

import FloodEvent from "../models/FloodEvent.js";
import FloodObservation from "../models/FloodObservation.js";

// Đăng ký model để populate nguồn bài viết.
import "../models/SourceArticle.js";

const observationPopulate = {
  path: "latestObservationId",
  select: [
    "code",
    "floodEventId",
    "status",
    "trend",
    "depthMinCm",
    "depthMaxCm",
    "depthMethod",
    "observedAt",
    "observedDate",
    "timePrecision",
    "sourceType",
    "reportId",
    "sourceArticleId",
    "note",
    "createdBy",
    "publishedAt",
    "createdAt",
    "updatedAt",
  ].join(" "),
  populate: {
    path: "sourceArticleId",
    select: "title publisher url publishedAt reviewStatus",
  },
};

const formatFloodEvent = (event) => {
  const observation = event.latestObservationId;

  return {
    id: event._id,
    code: event.code,
    regionCode: event.regionCode,
    title: event.title,
    address: event.address ?? null,
    location: event.location,
    locationNote: event.locationNote ?? "",

    dataMode: event.dataMode,
    isPublished: event.isPublished,
    publishedAt: event.publishedAt ?? null,
    lastStatusPublishedAt: event.lastStatusPublishedAt ?? null,

    latestObservation: observation
      ? {
          id: observation._id,
          code: observation.code,
          floodEventId: observation.floodEventId,
          status: observation.status,
          trend: observation.trend ?? "unknown",

          depthMinCm: observation.depthMinCm ?? null,
          depthMaxCm: observation.depthMaxCm ?? null,
          depthMethod: observation.depthMethod,

          observedAt: observation.observedAt ?? null,
          observedDate: observation.observedDate ?? null,
          timePrecision: observation.timePrecision,

          sourceType: observation.sourceType,
          reportId: observation.reportId ?? null,
          sourceArticle: observation.sourceArticleId ?? null,

          note: observation.note,
          createdBy: observation.createdBy ?? null,
          publishedAt: observation.publishedAt ?? null,
          createdAt: observation.createdAt,
          updatedAt: observation.updatedAt,
        }
      : null,

    createdBy: event.createdBy ?? null,
    updatedBy: event.updatedBy ?? null,
    revision: event.revision ?? 0,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
};

// GET /api/admin/flood-events
const getFloodEvents = async (req, res, next) => {
  try {
    const { mode, published, q } = req.query;

    // Không nhận mảng hoặc object trong các tham số này.
    const queryKeys = ["mode", "published", "q", "page", "limit"];

    for (const key of queryKeys) {
      if (req.query[key] !== undefined && typeof req.query[key] !== "string") {
        return res.status(400).json({
          message: `${key} phải là một giá trị chuỗi`,
        });
      }
    }

    const pageText = req.query.page ?? "1";
    const limitText = req.query.limit ?? "10";

    if (!/^[1-9]\d*$/.test(pageText) || !/^[1-9]\d*$/.test(limitText)) {
      return res.status(400).json({
        message: "page và limit phải là số nguyên dương",
      });
    }

    const page = Number(pageText);
    const limit = Number(limitText);

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "page không hợp lệ hoặc limit vượt quá 100",
      });
    }

    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: "Giá trị phân trang quá lớn",
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

    const keyword = q?.trim() ?? "";

    if (keyword.length > 200) {
      return res.status(400).json({
        message: "Từ khóa tìm kiếm không được vượt quá 200 ký tự",
      });
    }

    const filter = {
      regionCode: "HN",
      isDeleted: { $ne: true },
    };

    if (mode !== undefined) {
      filter.dataMode = mode;
    }

    if (published !== undefined) {
      filter.isPublished = published === "true";
    }

    if (keyword) {
      // Tìm chuỗi thông thường, không cho từ khóa trở thành biểu thức regex.
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { title: { $regex: escapedKeyword, $options: "i" } },
        { address: { $regex: escapedKeyword, $options: "i" } },
        { code: { $regex: escapedKeyword, $options: "i" } },
      ];
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
    return next(error);
  }
};

// GET /api/admin/flood-events/:id
const getFloodEventById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    const event = await FloodEvent.findOne({
      _id: id,
      regionCode: "HN",
      isDeleted: { $ne: true },
    })
      .populate(observationPopulate)
      .lean();

    if (!event) {
      return res.status(404).json({
        message: "Không tìm thấy địa điểm ngập",
      });
    }

    return res.status(200).json({
      data: formatFloodEvent(event),
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/admin/flood-events
const createFloodEvent = async (req, res, next) => {
  let session;

  try {
    const {
      title,
      address,
      coordinates,
      locationNote = "",
      dataMode = "current",
      isPublished = false,

      status,
      trend = "unknown",
      depthMinCm = null,
      depthMaxCm = null,
      depthMethod = "unknown",

      timePrecision = "unknown",
      observedAt = null,
      observedDate = null,
      note,
    } = req.body;

    const badRequest = (message) => {
      return res.status(400).json({ message });
    };

    if (typeof title !== "string" || !title.trim()) {
      return badRequest("Vui lòng nhập tên địa điểm ngập");
    }

    if (typeof address !== "string" || !address.trim()) {
      return badRequest("Vui lòng nhập địa chỉ");
    }

    if (typeof note !== "string" || !note.trim()) {
      return badRequest("Vui lòng nhập ghi chú xác nhận tình trạng");
    }

    if (typeof locationNote !== "string") {
      return badRequest("Ghi chú vị trí phải là chuỗi");
    }

    const validCoordinates =
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      coordinates.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ) &&
      coordinates[0] >= -180 &&
      coordinates[0] <= 180 &&
      coordinates[1] >= -90 &&
      coordinates[1] <= 90;

    if (!validCoordinates) {
      return badRequest("Tọa độ phải có dạng [kinh độ, vĩ độ] hợp lệ");
    }

    if (!["current", "historical"].includes(dataMode)) {
      return badRequest("Chế độ dữ liệu không hợp lệ");
    }

    if (typeof isPublished !== "boolean") {
      return badRequest("isPublished phải là true hoặc false");
    }

    if (!["flooded", "receded"].includes(status)) {
      return badRequest("Tình trạng ngập không hợp lệ");
    }

    if (!["rising", "falling", "stable", "unknown"].includes(trend)) {
      return badRequest("Xu hướng mực nước không hợp lệ");
    }

    if (!["unknown", "estimated", "measured"].includes(depthMethod)) {
      return badRequest("Phương pháp xác định độ sâu không hợp lệ");
    }

    const validDepthValue = (value) => {
      return (
        value === null ||
        (typeof value === "number" && Number.isFinite(value) && value >= 0)
      );
    };

    if (!validDepthValue(depthMinCm) || !validDepthValue(depthMaxCm)) {
      return badRequest("Độ sâu phải là số không âm hoặc null");
    }

    if (!["unknown", "day", "exact"].includes(timePrecision)) {
      return badRequest("Độ chính xác thời gian không hợp lệ");
    }

    if (
      observedDate !== null &&
      (typeof observedDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(observedDate))
    ) {
      return badRequest("Ngày ghi nhận phải có dạng YYYY-MM-DD");
    }

    let observationTime = null;

    if (observedAt !== null) {
      if (typeof observedAt !== "string") {
        return badRequest("Thời gian ghi nhận phải là chuỗi ISO có múi giờ");
      }

      // Tránh diễn giải thời gian theo múi giờ của máy chạy backend.
      if (!/(Z|[+-]\d{2}:\d{2})$/i.test(observedAt)) {
        return badRequest("Thời gian ghi nhận phải có Z hoặc múi giờ +07:00");
      }

      observationTime = new Date(observedAt);

      if (!Number.isFinite(observationTime.getTime())) {
        return badRequest("Thời gian ghi nhận không hợp lệ");
      }
    }

    const now = new Date();

    if (observationTime && observationTime > now) {
      return badRequest("Thời gian ghi nhận không được ở tương lai");
    }

    const todayInVietnam = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .reduce((result, part) => {
        result[part.type] = part.value;
        return result;
      }, {});

    const today = [
      todayInVietnam.year,
      todayInVietnam.month,
      todayInVietnam.day,
    ].join("-");

    if (observedDate && observedDate > today) {
      return badRequest("Ngày ghi nhận không được ở tương lai");
    }

    // Dữ liệu lịch sử phải xác định được ít nhất ngày ghi nhận.
    if (dataMode === "historical" && timePrecision === "unknown") {
      return badRequest("Dữ liệu lịch sử phải có ngày ghi nhận");
    }

    // Tạo sẵn ID để liên kết hai bản ghi.
    const floodEvent = new FloodEvent({
      code: `HN-${randomUUID()}`,
      regionCode: "HN",
      title: title.trim(),
      address: address.trim(),
      location: {
        type: "Point",
        coordinates,
      },
      locationNote: locationNote.trim(),
      dataMode,
      isPublished,
      publishedAt: isPublished ? now : null,
      lastStatusPublishedAt: isPublished ? now : null,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    const observation = new FloodObservation({
      code: `OBS-${randomUUID()}`,
      floodEventId: floodEvent._id,

      status,
      trend,
      depthMinCm,
      depthMaxCm,
      depthMethod,

      timePrecision,
      observedAt: observationTime,
      observedDate,

      sourceType: "admin",
      reportId: null,
      sourceArticleId: null,

      note: note.trim(),
      createdBy: req.user._id,
      publishedAt: isPublished ? now : null,
    });

    floodEvent.latestObservationId = observation._id;

    // Chạy cả các kiểm tra liên kết trường trong model.
    await floodEvent.validate();
    await observation.validate();

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      await floodEvent.save({ session });
      await observation.save({ session });
    });

    return res.status(201).json({
      message: isPublished
        ? "Đã đăng địa điểm ngập"
        : "Đã lưu nháp địa điểm ngập",
      data: {
        floodEvent: floodEvent.toObject(),
        latestObservation: observation.toObject(),
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Dữ liệu điểm ngập không hợp lệ",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// PATCH /api/admin/flood-events/:id/draft
const updateFloodEventDraft = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    const body = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Dữ liệu gửi lên phải là một object",
      });
    }

    const allowedFields = [
      "revision",
      "title",
      "address",
      "coordinates",
      "locationNote",
    ];

    const unknownFields = Object.keys(body).filter(
      (key) => !allowedFields.includes(key),
    );

    if (unknownFields.length > 0) {
      return res.status(400).json({
        message: `Không được sửa các trường: ${unknownFields.join(", ")}`,
      });
    }

    const { revision, title, address, coordinates, locationNote } = body;

    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({
        message: "revision phải là số nguyên không âm",
      });
    }

    const hasChanges = Object.keys(body).some((key) => key !== "revision");

    if (!hasChanges) {
      return res.status(400).json({
        message: "Vui lòng gửi ít nhất một trường cần sửa",
      });
    }

    for (const field of ["title", "address"]) {
      if (
        body[field] !== undefined &&
        (typeof body[field] !== "string" || !body[field].trim())
      ) {
        return res.status(400).json({
          message: `${field} phải là chuỗi không rỗng`,
        });
      }
    }

    if (locationNote !== undefined && typeof locationNote !== "string") {
      return res.status(400).json({
        message: "Ghi chú vị trí phải là chuỗi",
      });
    }

    if (coordinates !== undefined) {
      const validCoordinates =
        Array.isArray(coordinates) &&
        coordinates.length === 2 &&
        coordinates.every(
          (value) => typeof value === "number" && Number.isFinite(value),
        ) &&
        coordinates[0] >= -180 &&
        coordinates[0] <= 180 &&
        coordinates[1] >= -90 &&
        coordinates[1] <= 90;

      if (!validCoordinates) {
        return res.status(400).json({
          message: "Tọa độ phải có dạng [kinh độ, vĩ độ] hợp lệ",
        });
      }
    }

    const event = await FloodEvent.findOne({
      _id: id,
      regionCode: "HN",
      isDeleted: { $ne: true },
    });

    if (!event) {
      return res.status(404).json({
        message: "Không tìm thấy địa điểm ngập",
      });
    }

    if (event.isPublished || event.publishedAt) {
      return res.status(409).json({
        message: "API này chỉ sửa bản nháp chưa từng được đăng",
      });
    }

    if (event.revision !== revision) {
      return res.status(409).json({
        message: "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi sửa",
      });
    }

    if (title !== undefined) {
      event.title = title.trim();
    }

    if (address !== undefined) {
      event.address = address.trim();
    }

    if (coordinates !== undefined) {
      event.location = {
        type: "Point",
        coordinates,
      };
    }

    if (locationNote !== undefined) {
      event.locationNote = locationNote.trim();
    }

    event.updatedBy = req.user._id;

    // Model có optimisticConcurrency: true và versionKey: "revision".
    await event.save();

    const result = event.toObject();

    // Chỉ populate bản sao để trả về, sau khi đã lưu thành công.
    await FloodEvent.populate(result, observationPopulate);

    return res.status(200).json({
      message: "Đã cập nhật bản nháp",
      data: formatFloodEvent(result),
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Dữ liệu vừa được thay đổi. Vui lòng tải lại trước khi sửa",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Dữ liệu bản nháp không hợp lệ",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return next(error);
  }
};

// POST /api/admin/flood-events/:id/publish
const publishFloodEvent = async (req, res, next) => {
  let session;
  let publishedEvent;

  try {
    const { id } = req.params;
    const body = req.body;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "revision")
    ) {
      return res.status(400).json({
        message: "Chỉ gửi revision khi đăng bản nháp",
      });
    }

    const { revision } = body;

    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({
        message: "revision phải là số nguyên không âm",
      });
    }

    const createError = (status, message) => {
      const error = new Error(message);
      error.status = status;
      return error;
    };

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const event = await FloodEvent.findOne({
        _id: id,
        regionCode: "HN",
        isDeleted: { $ne: true },
      }).session(session);

      if (!event) {
        throw createError(404, "Không tìm thấy địa điểm ngập");
      }

      if (event.isPublished || event.publishedAt) {
        throw createError(409, "Địa điểm này đã được đăng trước đó");
      }

      if (event.revision !== revision) {
        throw createError(
          409,
          "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi đăng",
        );
      }

      if (!event.latestObservationId) {
        throw createError(409, "Bản nháp chưa có bản ghi tình trạng");
      }

      const observation = await FloodObservation.findOne({
        _id: event.latestObservationId,
        floodEventId: event._id,
      }).session(session);

      if (!observation) {
        throw createError(409, "Không tìm thấy bản ghi tình trạng phù hợp");
      }

      // Bước này chỉ xử lý luồng nhập thủ công.
      if (observation.sourceType !== "admin") {
        throw createError(409, "API này chỉ đăng bản nháp được nhập thủ công");
      }

      if (observation.publishedAt) {
        throw createError(409, "Bản ghi tình trạng đã được công bố trước đó");
      }

      const now = new Date();

      event.isPublished = true;
      event.publishedAt = now;
      event.lastStatusPublishedAt = now;
      event.updatedBy = req.user._id;

      observation.publishedAt = now;

      // save() chạy lại các kiểm tra trong model.
      await observation.save({ session });
      await event.save({ session });

      publishedEvent = event.toObject();
      publishedEvent.latestObservationId = observation.toObject();
    });

    return res.status(200).json({
      message: "Đã đăng địa điểm ngập",
      data: formatFloodEvent(publishedEvent),
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Dữ liệu vừa thay đổi. Vui lòng tải lại trước khi đăng",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Bản nháp chưa đủ điều kiện đăng",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    if ([404, 409].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// POST /api/admin/flood-events/:id/observations
const addFloodObservation = async (req, res, next) => {
  let session;
  let result;

  try {
    const { id } = req.params;
    const body = req.body;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Dữ liệu gửi lên phải là một object",
      });
    }

    const allowedFields = [
      "revision",
      "status",
      "trend",
      "depthMinCm",
      "depthMaxCm",
      "depthMethod",
      "timePrecision",
      "observedAt",
      "observedDate",
      "note",
    ];

    const unknownFields = Object.keys(body).filter(
      (key) => !allowedFields.includes(key),
    );

    if (unknownFields.length > 0) {
      return res.status(400).json({
        message: `Không được gửi các trường: ${unknownFields.join(", ")}`,
      });
    }

    const {
      revision,
      status,
      trend = "unknown",
      depthMinCm = null,
      depthMaxCm = null,
      depthMethod = "unknown",
      timePrecision = "unknown",
      observedAt = null,
      observedDate = null,
      note,
    } = body;

    const badRequest = (message) => {
      return res.status(400).json({ message });
    };

    if (!Number.isSafeInteger(revision) || revision < 0) {
      return badRequest("revision phải là số nguyên không âm");
    }

    if (!["flooded", "receded"].includes(status)) {
      return badRequest("Tình trạng ngập không hợp lệ");
    }

    if (!["rising", "falling", "stable", "unknown"].includes(trend)) {
      return badRequest("Xu hướng mực nước không hợp lệ");
    }

    if (!["unknown", "estimated", "measured"].includes(depthMethod)) {
      return badRequest("Phương pháp xác định độ sâu không hợp lệ");
    }

    for (const depth of [depthMinCm, depthMaxCm]) {
      if (
        depth !== null &&
        (typeof depth !== "number" || !Number.isFinite(depth) || depth < 0)
      ) {
        return badRequest("Độ sâu phải là số không âm hoặc null");
      }
    }

    if (!["unknown", "day", "exact"].includes(timePrecision)) {
      return badRequest("Độ chính xác thời gian không hợp lệ");
    }

    if (typeof note !== "string" || !note.trim()) {
      return badRequest("Vui lòng nhập ghi chú xác nhận tình trạng");
    }

    if (
      observedDate !== null &&
      (typeof observedDate !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(observedDate))
    ) {
      return badRequest("Ngày ghi nhận phải có dạng YYYY-MM-DD");
    }

    let observationTime = null;

    if (observedAt !== null) {
      if (
        typeof observedAt !== "string" ||
        !/(Z|[+-]\d{2}:\d{2})$/i.test(observedAt)
      ) {
        return badRequest("Thời gian ghi nhận phải có múi giờ");
      }

      observationTime = new Date(observedAt);

      if (!Number.isFinite(observationTime.getTime())) {
        return badRequest("Thời gian ghi nhận không hợp lệ");
      }
    }

    const createError = (statusCode, message) => {
      const error = new Error(message);
      error.status = statusCode;
      return error;
    };

    session = await mongoose.startSession();

    await session.withTransaction(async () => {
      const event = await FloodEvent.findOne({
        _id: id,
        regionCode: "HN",
        isDeleted: { $ne: true },
      }).session(session);

      if (!event) {
        throw createError(404, "Không tìm thấy địa điểm ngập");
      }

      if (!event.isPublished || !event.publishedAt) {
        throw createError(
          409,
          "Chỉ cập nhật tình trạng cho địa điểm đang được công bố",
        );
      }

      if (event.revision !== revision) {
        throw createError(
          409,
          "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi cập nhật",
        );
      }

      if (event.dataMode === "historical" && timePrecision === "unknown") {
        throw createError(400, "Dữ liệu lịch sử phải có ngày ghi nhận");
      }

      const now = new Date();

      if (observationTime && observationTime > now) {
        throw createError(400, "Thời gian ghi nhận không được ở tương lai");
      }

      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .formatToParts(now)
        .reduce((value, part) => {
          value[part.type] = part.value;
          return value;
        }, {});

      const today = `${parts.year}-${parts.month}-${parts.day}`;

      if (observedDate && observedDate > today) {
        throw createError(400, "Ngày ghi nhận không được ở tương lai");
      }

      const observation = new FloodObservation({
        code: `OBS-${randomUUID()}`,
        floodEventId: event._id,

        status,
        trend,
        depthMinCm,
        depthMaxCm,
        depthMethod,

        timePrecision,
        observedAt: observationTime,
        observedDate,

        sourceType: "admin",
        reportId: null,
        sourceArticleId: null,
        note: note.trim(),
        createdBy: req.user._id,
        publishedAt: now,
      });

      // Model kiểm tra thêm độ sâu, thời gian và tình trạng đã rút.
      await observation.save({ session });

      event.latestObservationId = observation._id;
      event.lastStatusPublishedAt = now;
      event.updatedBy = req.user._id;

      // Giữ nguyên publishedAt: đây là thời gian đăng lần đầu.
      await event.save({ session });

      result = event.toObject();
      result.latestObservationId = observation.toObject();
    });

    return res.status(201).json({
      message: "Đã cập nhật tình trạng ngập",
      data: formatFloodEvent(result),
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Dữ liệu vừa thay đổi. Vui lòng tải lại trước khi cập nhật",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Dữ liệu tình trạng không hợp lệ",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    if ([400, 404, 409].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  } finally {
    if (session) {
      await session.endSession();
    }
  }
};

// GET /api/admin/flood-events/:id/observations
const getFloodObservations = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    const pageText = req.query.page ?? "1";
    const limitText = req.query.limit ?? "10";

    if (
      typeof pageText !== "string" ||
      typeof limitText !== "string" ||
      !/^[1-9]\d*$/.test(pageText) ||
      !/^[1-9]\d*$/.test(limitText)
    ) {
      return res.status(400).json({
        message: "page và limit phải là số nguyên dương",
      });
    }

    const page = Number(pageText);
    const limit = Number(limitText);
    const skip = (page - 1) * limit;

    if (
      !Number.isSafeInteger(page) ||
      !Number.isSafeInteger(limit) ||
      limit > 100 ||
      !Number.isSafeInteger(skip)
    ) {
      return res.status(400).json({
        message: "Phân trang không hợp lệ; limit tối đa 100",
      });
    }

    const event = await FloodEvent.findOne({
      _id: id,
      regionCode: "HN",
      isDeleted: { $ne: true },
    })
      .select("title latestObservationId")
      .lean();

    if (!event) {
      return res.status(404).json({
        message: "Không tìm thấy địa điểm ngập",
      });
    }

    const filter = {
      floodEventId: event._id,
    };

    const [observations, total] = await Promise.all([
      FloodObservation.find(filter)
        .select(
          [
            "code",
            "status",
            "trend",
            "depthMinCm",
            "depthMaxCm",
            "depthMethod",
            "observedAt",
            "observedDate",
            "timePrecision",
            "sourceType",
            "reportId",
            "sourceArticleId",
            "note",
            "createdBy",
            "publishedAt",
            "createdAt",
          ].join(" "),
        )
        .populate({
          path: "sourceArticleId",
          select: "title publisher url publishedAt",
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FloodObservation.countDocuments(filter),
    ]);

    return res.status(200).json({
      event: {
        id: event._id,
        title: event.title,
        latestObservationId: event.latestObservationId ?? null,
      },
      count: observations.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: observations.map((observation) => ({
        id: observation._id,
        code: observation.code,

        isLatest: String(observation._id) === String(event.latestObservationId),

        status: observation.status,
        trend: observation.trend,
        depthMinCm: observation.depthMinCm ?? null,
        depthMaxCm: observation.depthMaxCm ?? null,
        depthMethod: observation.depthMethod,

        observedAt: observation.observedAt ?? null,
        observedDate: observation.observedDate ?? null,
        timePrecision: observation.timePrecision,

        sourceType: observation.sourceType,
        reportId: observation.reportId ?? null,
        sourceArticle: observation.sourceArticleId ?? null,

        note: observation.note,
        createdBy: observation.createdBy,
        publishedAt: observation.publishedAt ?? null,
        createdAt: observation.createdAt,
      })),
    });
  } catch (error) {
    return next(error);
  }
};
// DELETE /api/admin/flood-events/:id
const deleteFloodEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "ID địa điểm ngập không hợp lệ",
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        message: "Dữ liệu gửi lên không hợp lệ",
      });
    }

    if (
      Object.keys(body).some((key) => !["revision", "reason"].includes(key))
    ) {
      return res.status(400).json({
        message: "Chỉ gửi revision và reason",
      });
    }

    const { revision, reason } = body;

    if (!Number.isSafeInteger(revision) || revision < 0) {
      return res.status(400).json({
        message: "revision phải là số nguyên không âm",
      });
    }

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 500
    ) {
      return res.status(400).json({
        message: "Lý do xóa phải có từ 1 đến 500 ký tự",
      });
    }

    const filter = {
      _id: id,
      regionCode: "HN",
      isDeleted: { $ne: true },
    };

    // Các bản ghi khảo sát cũ có thể chưa có trường revision.
    if (revision === 0) {
      filter.$or = [{ revision: 0 }, { revision: { $exists: false } }];
    } else {
      filter.revision = revision;
    }

    const deleted = await FloodEvent.findOneAndUpdate(
      filter,
      {
        $set: {
          isDeleted: true,
          isPublished: false,
          deletedAt: new Date(),
          deletedBy: req.user._id,
          deletionReason: reason.trim(),
          updatedBy: req.user._id,
        },

        // Cập nhật truy vấn phải tự tăng revision.
        $inc: {
          revision: 1,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select("_id isDeleted revision")
      .lean();

    if (!deleted) {
      const existing = await FloodEvent.findOne({
        _id: id,
        regionCode: "HN",
        isDeleted: { $ne: true },
      })
        .select("_id")
        .lean();

      if (!existing) {
        return res.status(404).json({
          message: "Không tìm thấy điểm ngập hoặc điểm đã bị xóa",
        });
      }

      return res.status(409).json({
        message: "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi xóa",
      });
    }

    return res.status(200).json({
      message: "Đã xóa điểm ngập khỏi danh sách và bản đồ",
      data: {
        id: deleted._id,
        isDeleted: deleted.isDeleted,
        revision: deleted.revision,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Thông tin xóa không hợp lệ",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    return next(error);
  }
};
export default {
  getFloodEvents,
  getFloodEventById,
  createFloodEvent,
  updateFloodEventDraft,
  publishFloodEvent,
  addFloodObservation,
  getFloodObservations,
  deleteFloodEvent,
};
