import { randomUUID } from "node:crypto";
import FloodReport from "../models/FloodReport.js";
import reportImageService from "../services/reportImageService.js";
import mongoose from "mongoose";
import getCloudinary from "../config/cloudinary.js";
import FloodEvent from "../models/FloodEvent.js";
import FloodObservation from "../models/FloodObservation.js";
const createFloodReport = async (req, res, next) => {
  const uploadedKeys = [];
  let saved = false;

  try {
    const isResubmission = Boolean(req.params.id);
    let existingReport = null;
    const body = req.body || {};

    const allowedFields = [
      "address",
      "coordinates",
      "description",
      "observedAt",
      "estimatedDepthCm",
      ...(isResubmission ? ["revision"] : []),
    ];

    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
      return res.status(400).json({
        message: "Form có trường không được phép gửi",
      });
    }

    if (isResubmission) {
      if (!mongoose.isObjectIdOrHexString(req.params.id)) {
        return res.status(400).json({
          message: "Mã báo cáo không hợp lệ",
        });
      }

      const revisionText = body.revision;

      if (
        typeof revisionText !== "string" ||
        !/^(0|[1-9]\d*)$/.test(revisionText) ||
        !Number.isSafeInteger(Number(revisionText))
      ) {
        return res.status(400).json({
          message: "Phiên bản báo cáo không hợp lệ",
        });
      }

      existingReport = await FloodReport.findOne({
        _id: req.params.id,
        userId: req.user._id,
      });

      if (!existingReport) {
        return res.status(404).json({
          message: "Không tìm thấy báo cáo",
        });
      }

      if (existingReport.status !== "rejected") {
        return res.status(409).json({
          message: "Chỉ được sửa và gửi lại báo cáo bị bác bỏ",
        });
      }

      if (existingReport.revision !== Number(revisionText)) {
        return res.status(409).json({
          message: "Báo cáo đã thay đổi. Vui lòng tải lại trước khi sửa",
        });
      }
    }

    const {
      address,
      coordinates: coordinatesText,
      description,
      observedAt: observedAtText,
      estimatedDepthCm: depthText,
    } = body;

    if (
      typeof address !== "string" ||
      !address.trim() ||
      address.trim().length > 1000
    ) {
      return res.status(400).json({
        message: "Địa chỉ phải có từ 1 đến 1000 ký tự",
      });
    }

    if (
      typeof description !== "string" ||
      !description.trim() ||
      description.trim().length > 5000 ||
      description.trim().split(/\s+/).length > 200
    ) {
      return res.status(400).json({
        message: "Mô tả phải có nội dung, không quá 200 từ và 5000 ký tự",
      });
    }

    let coordinates;

    try {
      if (typeof coordinatesText !== "string") {
        throw new Error();
      }

      coordinates = JSON.parse(coordinatesText);
    } catch {
      return res.status(400).json({
        message: "coordinates phải là chuỗi JSON [kinh độ, vĩ độ]",
      });
    }

    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(
        (value) => typeof value === "number" && Number.isFinite(value),
      ) ||
      coordinates[0] < -180 ||
      coordinates[0] > 180 ||
      coordinates[1] < -90 ||
      coordinates[1] > 90
    ) {
      return res.status(400).json({
        message: "Tọa độ không hợp lệ",
      });
    }

    if (
      typeof observedAtText !== "string" ||
      !/(Z|[+-]\d{2}:\d{2})$/i.test(observedAtText)
    ) {
      return res.status(400).json({
        message: "Thời gian quan sát phải có múi giờ",
      });
    }

    const observedAt = new Date(observedAtText);
    const submittedAt = new Date();

    if (!Number.isFinite(observedAt.getTime()) || observedAt > submittedAt) {
      return res.status(400).json({
        message: "Thời gian quan sát không hợp lệ hoặc nằm ở tương lai",
      });
    }

    let estimatedDepthCm = null;

    if (depthText !== undefined && depthText !== "") {
      if (
        typeof depthText !== "string" ||
        !/^\d+(?:\.\d+)?$/.test(depthText.trim())
      ) {
        return res.status(400).json({
          message: "Độ sâu phải là số không âm",
        });
      }

      estimatedDepthCm = Number(depthText);

      if (!Number.isFinite(estimatedDepthCm)) {
        return res.status(400).json({
          message: "Độ sâu không hợp lệ",
        });
      }
    }

    const incomingFiles = Array.isArray(req.files) ? req.files : [];

    if (
      incomingFiles.length > 3 ||
      (!isResubmission && incomingFiles.length < 1)
    ) {
      return res.status(400).json({
        message: "Báo cáo cần từ 1 đến 3 ảnh",
      });
    }

    if (
      isResubmission &&
      incomingFiles.length === 0 &&
      (!existingReport.images.length || existingReport.images.length > 3)
    ) {
      return res.status(400).json({
        message: "Vui lòng chọn lại từ 1 đến 3 ảnh",
      });
    }

    // Kiểm tra tất cả ảnh trước khi bắt đầu upload.
    const preparedImages = [];

    for (const file of incomingFiles) {
      preparedImages.push(await reportImageService.prepareImage(file));
    }

    // Không chọn ảnh mới khi gửi lại thì giữ nguyên ảnh hiện tại.
    const images =
      isResubmission && incomingFiles.length === 0
        ? existingReport.toObject().images
        : [];

    for (const prepared of preparedImages) {
      const storageKey = reportImageService.createStorageKey(
        req.user._id.toString(),
      );

      // Ghi nhận trước để có thể dọn nếu upload hoặc lưu DB lỗi.
      uploadedKeys.push(storageKey);

      images.push(
        await reportImageService.uploadImage({
          prepared,
          storageKey,
        }),
      );
    }

    const content = {
      location: {
        type: "Point",
        coordinates,
      },
      address: address.trim(),
      description: description.trim(),
      observedAt,
      estimatedDepthCm,
      images,
    };

    let report;

    if (isResubmission) {
      report = existingReport;

      report.set(content);
      report.status = "pending";
      report.submittedAt = submittedAt;

      // Kết quả xử lý cũ đã nằm trong history.
      report.reviewedBy = null;
      report.reviewedAt = null;
      report.reviewNote = "";
      report.floodEventId = null;
      report.floodObservationId = null;

      report.history.push({
        action: "resubmitted",
        actorId: req.user._id,
        actedAt: submittedAt,
        note: "",
        snapshot: content,
      });
    } else {
      report = new FloodReport({
        userId: req.user._id,
        ...content,
        status: "pending",
        submittedAt,
        history: [
          {
            action: "submitted",
            actorId: req.user._id,
            actedAt: submittedAt,
            note: "",
            snapshot: content,
          },
        ],
      });
    }

    await report.save();
    saved = true;

    return res.status(isResubmission ? 200 : 201).json({
      message: isResubmission
        ? "Đã gửi lại báo cáo. Thông tin đang chờ admin xác minh"
        : "Đã gửi báo cáo. Thông tin đang chờ admin xác minh",
      data: {
        id: report._id,
        status: report.status,
        submittedAt: report.submittedAt,
        revision: report.revision,
      },
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Báo cáo đã thay đổi. Vui lòng tải lại trước khi gửi",
      });
    }
    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Dữ liệu báo cáo không hợp lệ",
        errors: Object.values(error.errors).map((item) => item.message),
      });
    }

    // Không đưa nguyên lỗi nhà cung cấp ra frontend.
    console.error("Không thể tạo báo cáo:", error.name || "UnknownError");

    return res.status(500).json({
      message: "Không gửi được báo cáo. Vui lòng thử lại sau",
    });
  } finally {
    if (!saved && uploadedKeys.length > 0) {
      try {
        await reportImageService.removeImages(uploadedKeys);
      } catch {
        console.error("Chưa hoàn tất dọn ảnh của báo cáo gửi thất bại");
      }
    }
  }
};

const listReports = async (req, res, next, adminMode) => {
  try {
    const pageText = req.query.page ?? "1";
    const limitText = req.query.limit ?? "10";
    const status = req.query.status;

    if (
      typeof pageText !== "string" ||
      !/^[1-9]\d*$/.test(pageText) ||
      typeof limitText !== "string" ||
      !["10", "20"].includes(limitText)
    ) {
      return res.status(400).json({
        message: "page phải là số nguyên dương; limit chỉ nhận 10 hoặc 20",
      });
    }

    if (
      status !== undefined &&
      !["pending", "approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        message: "Trạng thái báo cáo không hợp lệ",
      });
    }

    const page = Number(pageText);
    const limit = Number(limitText);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: "Giá trị phân trang quá lớn",
      });
    }

    // Người dùng chỉ lấy được báo cáo của chính mình.
    const filter = adminMode ? {} : { userId: req.user._id };

    if (status) {
      filter.status = status;
    }

    const [reports, total] = await Promise.all([
      FloodReport.find(filter)
        .select(
          "address description status observedAt submittedAt " +
            "reviewedAt reviewNote revision",
        )
        .sort({ submittedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FloodReport.countDocuments(filter),
    ]);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      count: reports.length,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: reports.map((report) => ({
        id: report._id,
        address: report.address,
        description: report.description,
        status: report.status,
        observedAt: report.observedAt,
        submittedAt: report.submittedAt,
        reviewedAt: report.reviewedAt ?? null,
        reviewNote: report.reviewNote || "",
        revision: report.revision,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/flood-reports/mine
const getMyReports = (req, res, next) => {
  return listReports(req, res, next, false);
};

// GET /api/admin/flood-reports
const getAdminReports = (req, res, next) => {
  return listReports(req, res, next, true);
};

// Dùng chung cho chi tiết và ảnh.
// Admin xem tất cả; người dùng chỉ xem báo cáo của mình.
const findAccessibleReport = (req) => {
  const filter = {
    _id: req.params.id,
  };

  if (req.user.role !== "admin") {
    filter.userId = req.user._id;
  }

  return FloodReport.findOne(filter);
};

// GET /api/flood-reports/:id
const getReportById = async (req, res, next) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) {
      return res.status(400).json({
        message: "ID báo cáo không hợp lệ",
      });
    }

    const report = await findAccessibleReport(req)
      .select(
        "address location description observedAt estimatedDepthCm " +
          "images status submittedAt reviewedAt reviewNote " +
          "floodEventId revision",
      )
      .lean();

    if (!report) {
      return res.status(404).json({
        message: "Không tìm thấy báo cáo",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      data: {
        id: report._id,
        address: report.address,
        location: report.location,
        description: report.description,
        observedAt: report.observedAt,
        estimatedDepthCm: report.estimatedDepthCm ?? null,
        status: report.status,
        submittedAt: report.submittedAt,
        reviewedAt: report.reviewedAt ?? null,
        reviewNote: report.reviewNote || "",
        floodEventId: report.floodEventId ?? null,
        revision: report.revision,

        // Không trả URL gốc hoặc storageKey ra frontend.
        images: report.images.map((image, index) => ({
          index,
          width: image.width,
          height: image.height,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/flood-reports/:id/images/:index
const getReportImage = async (req, res, next) => {
  try {
    const { id, index } = req.params;

    if (!mongoose.isObjectIdOrHexString(id) || !/^[0-2]$/.test(index)) {
      return res.status(400).json({
        message: "Thông tin ảnh không hợp lệ",
      });
    }

    const report = await findAccessibleReport(req).select("images").lean();

    const image = report?.images[Number(index)];

    if (!image) {
      return res.status(404).json({
        message: "Không tìm thấy ảnh",
      });
    }

    const cloudinary = getCloudinary();

    const downloadUrl = cloudinary.utils.private_download_url(
      image.storageKey,
      "webp",
      {
        resource_type: "image",
        type: "authenticated",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    );

    const upstream = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });

    if (!upstream.ok) {
      console.error("Không lấy được ảnh Cloudinary:", upstream.status);

      return res.status(502).json({
        message: "Chưa tải được ảnh báo cáo",
      });
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());

    res.set({
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": 'inline; filename="report-image.webp"',
    });

    return res.status(200).send(buffer);
  } catch (error) {
    if (error.name === "TimeoutError") {
      return res.status(504).json({
        message: "Tải ảnh quá thời gian. Vui lòng thử lại",
      });
    }

    return next(error);
  }
};
// POST /api/admin/flood-reports/:id/reject
const rejectReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { revision, reason } = req.body || {};

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "Mã báo cáo không hợp lệ",
      });
    }

    if (!Number.isInteger(revision) || revision < 0) {
      return res.status(400).json({
        message: "Phiên bản báo cáo không hợp lệ",
      });
    }

    if (
      typeof reason !== "string" ||
      !reason.trim() ||
      reason.trim().length > 1000
    ) {
      return res.status(400).json({
        message: "Lý do từ chối phải có từ 1 đến 1000 ký tự",
      });
    }

    const report = await FloodReport.findById(id);

    if (!report) {
      return res.status(404).json({
        message: "Không tìm thấy báo cáo",
      });
    }

    if (report.status !== "pending") {
      return res.status(409).json({
        message: "Báo cáo đã được xử lý. Vui lòng tải lại",
      });
    }

    if (report.revision !== revision) {
      return res.status(409).json({
        message: "Báo cáo đã thay đổi. Vui lòng tải lại",
      });
    }

    const now = new Date();
    const reviewNote = reason.trim();
    const content = report.toObject();

    report.status = "rejected";
    report.reviewedBy = req.user._id;
    report.reviewedAt = now;
    report.reviewNote = reviewNote;

    report.history.push({
      action: "rejected",
      actorId: req.user._id,
      actedAt: now,
      note: reviewNote,
      snapshot: {
        location: content.location,
        address: content.address,
        description: content.description,
        images: content.images,
        observedAt: content.observedAt,
        estimatedDepthCm: content.estimatedDepthCm,
      },
    });

    // optimisticConcurrency của model ngăn hai admin xử lý trùng.
    await report.save();

    return res.status(200).json({
      message: "Đã từ chối báo cáo",
      data: {
        id: report._id,
        status: report.status,
        reviewedAt: report.reviewedAt,
        reviewNote: report.reviewNote,
        revision: report.revision,
      },
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Báo cáo đã thay đổi. Vui lòng tải lại",
      });
    }

    return next(error);
  }
};
// POST /api/admin/flood-reports/:id/approve
const approveReport = async (req, res, next) => {
  let session;

  try {
    const { id } = req.params;
    const {
      revision,
      action,
      floodEventId,
      eventRevision,
      title,
      status,
      trend = "unknown",
      depthCm = null,
      note,
    } = req.body || {};

    const fail = (statusCode, message) => {
      const error = new Error(message);
      error.status = statusCode;
      throw error;
    };

    if (!mongoose.isObjectIdOrHexString(id)) {
      fail(400, "Mã báo cáo không hợp lệ");
    }

    if (!Number.isInteger(revision) || revision < 0) {
      fail(400, "Phiên bản báo cáo không hợp lệ");
    }

    if (!["create", "update"].includes(action)) {
      fail(400, "Chọn tạo điểm mới hoặc cập nhật điểm có sẵn");
    }

    if (
      action === "create" &&
      (typeof title !== "string" || !title.trim() || title.trim().length > 200)
    ) {
      fail(400, "Tên điểm ngập phải có từ 1 đến 200 ký tự");
    }

    if (
      action === "update" &&
      (!mongoose.isObjectIdOrHexString(floodEventId) ||
        !Number.isInteger(eventRevision) ||
        eventRevision < 0)
    ) {
      fail(400, "Điểm ngập hoặc phiên bản điểm ngập không hợp lệ");
    }

    if (!["flooded", "receded"].includes(status)) {
      fail(400, "Tình trạng ngập không hợp lệ");
    }

    if (!["unknown", "rising", "falling", "stable"].includes(trend)) {
      fail(400, "Diễn biến không hợp lệ");
    }

    if (
      depthCm !== null &&
      (typeof depthCm !== "number" || !Number.isFinite(depthCm) || depthCm < 0)
    ) {
      fail(400, "Độ sâu phải là số không âm hoặc để chưa rõ");
    }

    if (
      status === "receded" &&
      (trend !== "unknown" || (depthCm !== null && depthCm !== 0))
    ) {
      fail(400, "Đã rút thì diễn biến để chưa rõ, độ sâu là 0 hoặc chưa rõ");
    }

    if (typeof note !== "string" || !note.trim() || note.trim().length > 1000) {
      fail(400, "Ghi chú xác minh phải có từ 1 đến 1000 ký tự");
    }

    session = await mongoose.startSession();

    let responseData;

    await session.withTransaction(async () => {
      const report = await FloodReport.findById(id).session(session);

      if (!report) {
        fail(404, "Không tìm thấy báo cáo");
      }

      if (report.status !== "pending" || report.revision !== revision) {
        fail(409, "Báo cáo đã thay đổi hoặc đã xử lý. Vui lòng tải lại");
      }

      const now = new Date();
      const observedAt = report.observedAt;

      if (
        !(observedAt instanceof Date) ||
        Number.isNaN(observedAt.getTime()) ||
        observedAt > now
      ) {
        fail(400, "Thời gian quan sát của báo cáo không hợp lệ");
      }

      let event;

      if (action === "update") {
        event = await FloodEvent.findOne({
          _id: floodEventId,
          regionCode: "HN",
          dataMode: "current",
          isPublished: true,
          isDeleted: { $ne: true },
        }).session(session);

        if (!event) {
          fail(404, "Không tìm thấy điểm ngập hiện tại đã công bố");
        }

        if (event.revision !== eventRevision) {
          fail(409, "Điểm ngập đã thay đổi. Vui lòng chọn lại điểm");
        }

        if (event.latestObservationId) {
          const latest = await FloodObservation.findOne({
            _id: event.latestObservationId,
            floodEventId: event._id,
          }).session(session);

          // Không lấy báo cáo cũ ghi đè quan sát thực tế mới hơn.
          if (latest?.observedAt && observedAt < latest.observedAt) {
            fail(
              409,
              "Báo cáo có thời gian quan sát cũ hơn cập nhật hiện tại của điểm ngập",
            );
          }
        }
      } else {
        event = new FloodEvent({
          code: `HN-${randomUUID()}`,
          regionCode: "HN",
          title: title.trim(),
          address: report.address,
          location: {
            type: "Point",
            coordinates: [...report.location.coordinates],
          },
          locationNote: "",
          dataMode: "current",
          isPublished: true,
          publishedAt: now,
          createdBy: req.user._id,
          updatedBy: req.user._id,
        });
      }

      const dateParts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(observedAt);

      const dateValues = Object.fromEntries(
        dateParts.map((part) => [part.type, part.value]),
      );

      const observedDate = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

      const observation = new FloodObservation({
        code: `OBS-${randomUUID()}`,
        floodEventId: event._id,
        status,
        trend,
        depthMinCm: depthCm,
        depthMaxCm: depthCm,
        depthMethod: depthCm === null ? "unknown" : "estimated",
        observedAt,
        observedDate,
        timePrecision: "exact",
        sourceType: "user_report",
        reportId: report._id,
        sourceArticleId: null,
        note: note.trim(),
        createdBy: req.user._id,
        publishedAt: now,
      });

      await observation.save({ session });

      event.latestObservationId = observation._id;
      event.lastStatusPublishedAt = now;
      event.updatedBy = req.user._id;

      await event.save({ session });

      const content = report.toObject();

      report.status = "approved";
      report.reviewedBy = req.user._id;
      report.reviewedAt = now;
      report.reviewNote = note.trim();
      report.floodEventId = event._id;
      report.floodObservationId = observation._id;

      report.history.push({
        action: "approved",
        actorId: req.user._id,
        actedAt: now,
        note: note.trim(),
        snapshot: {
          location: content.location,
          address: content.address,
          description: content.description,
          images: content.images,
          observedAt: content.observedAt,
          estimatedDepthCm: content.estimatedDepthCm,
        },
      });

      await report.save({ session });

      responseData = {
        id: report._id,
        status: report.status,
        revision: report.revision,
        floodEventId: event._id,
        floodObservationId: observation._id,
      };
    });

    return res.status(200).json({
      message: "Đã chấp nhận báo cáo và công bố thông tin ngập",
      data: responseData,
    });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({
        message: "Dữ liệu đã thay đổi. Vui lòng tải lại trước khi duyệt",
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
export default {
  createFloodReport,
  getMyReports,
  getAdminReports,
  getReportById,
  rejectReport,
  getReportImage,
  approveReport,
};
