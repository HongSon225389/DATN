import mongoose from "mongoose";

const floodObservationSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    floodEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodEvent",
      required: true,
    },

    // Tình trạng: đang ngập / đã rút.
    status: {
      type: String,
      enum: ["flooded", "receded"],
      required: true,
    },

    // Diễn biến trong lúc còn ngập.
    trend: {
      type: String,
      enum: ["rising", "falling", "stable", "unknown"],
      default: "unknown",
    },

    // Chưa rõ độ sâu: cả hai để null.
    // Một giá trị cụ thể: min và max bằng nhau.
    depthMinCm: {
      type: Number,
      min: 0,
      default: null,
    },

    depthMaxCm: {
      type: Number,
      min: 0,
      default: null,
    },

    depthMethod: {
      type: String,
      enum: ["unknown", "estimated", "measured"],
      default: "unknown",
    },

    // Thời điểm thực tế, chỉ điền khi biết rõ.
    observedAt: {
      type: Date,
      default: null,
    },

    // Ngày tại Việt Nam: YYYY-MM-DD.
    observedDate: {
      type: String,
      default: null,
    },

    timePrecision: {
      type: String,
      enum: ["unknown", "day", "exact"],
      default: "unknown",
    },

    sourceType: {
      type: String,
      enum: ["admin", "user_report", "web_article"],
      required: true,
    },

    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodReport",
      default: null,
    },

    sourceArticleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SourceArticle",
      default: null,
    },

    // Căn cứ và ghi chú nội bộ.
    note: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Giờ Admin công bố quan sát, khác giờ quan sát thực tế.
    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "floodObservations",
  },
);

// Kiểm tra ngày lịch.
const isValidDateString = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

// Lấy ngày Việt Nam của một thời điểm.
const getVietnamDate = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = {};

  for (const part of parts) {
    values[part.type] = part.value;
  }

  return `${values.year}-${values.month}-${values.day}`;
};

floodObservationSchema.pre("validate", function () {
  const hasMin = this.depthMinCm != null;
  const hasMax = this.depthMaxCm != null;

  // 1. Kiểm tra độ sâu.
  if (hasMin !== hasMax) {
    this.invalidate(
      "depthMinCm",
      "Cần nhập đủ khoảng độ sâu hoặc để cả hai null",
    );
  }

  if (
    hasMin &&
    hasMax &&
    (!Number.isFinite(this.depthMinCm) ||
      !Number.isFinite(this.depthMaxCm) ||
      this.depthMinCm > this.depthMaxCm)
  ) {
    this.invalidate("depthMaxCm", "Khoảng độ sâu không hợp lệ");
  }

  if (this.depthMethod === "unknown" && (hasMin || hasMax)) {
    this.invalidate(
      "depthMethod",
      "Chưa rõ cách xác định độ sâu thì không lưu giá trị",
    );
  }

  if (
    ["estimated", "measured"].includes(this.depthMethod) &&
    (!hasMin || !hasMax)
  ) {
    this.invalidate("depthMethod", "Cần có giá trị độ sâu tương ứng");
  }

  // Đã rút thì không ghi diễn biến đang dâng/giảm.
  if (this.status === "receded") {
    if (this.trend !== "unknown") {
      this.invalidate("trend", "Đã rút thì diễn biến để unknown");
    }

    if (
      (hasMin && this.depthMinCm !== 0) ||
      (hasMax && this.depthMaxCm !== 0)
    ) {
      this.invalidate(
        "depthMaxCm",
        "Đã rút thì độ sâu phải là 0 hoặc chưa có thông tin",
      );
    }
  }

  // 2. Kiểm tra căn cứ nguồn.
  if (this.sourceType === "admin") {
    if (this.reportId || this.sourceArticleId) {
      this.invalidate(
        "sourceType",
        "Nguồn admin không gắn reportId hoặc sourceArticleId",
      );
    }
  }

  if (this.sourceType === "user_report") {
    if (!this.reportId || this.sourceArticleId) {
      this.invalidate(
        "reportId",
        "Nguồn báo cáo cần reportId và không có sourceArticleId",
      );
    }
  }

  if (this.sourceType === "web_article") {
    if (!this.sourceArticleId || this.reportId) {
      this.invalidate(
        "sourceArticleId",
        "Nguồn web cần sourceArticleId và không có reportId",
      );
    }
  }

  // 3. Kiểm tra thời gian.
  if (this.observedDate != null && !isValidDateString(this.observedDate)) {
    this.invalidate(
      "observedDate",
      "Ngày quan sát không hợp lệ, cần dạng YYYY-MM-DD",
    );
  }

  if (this.timePrecision === "unknown") {
    if (this.observedAt != null || this.observedDate != null) {
      this.invalidate(
        "timePrecision",
        "Thời gian chưa rõ thì observedAt và observedDate để null",
      );
    }
  }

  if (this.timePrecision === "day") {
    if (!isValidDateString(this.observedDate) || this.observedAt != null) {
      this.invalidate(
        "timePrecision",
        "Chỉ rõ ngày thì cần observedDate và observedAt để null",
      );
    }
  }

  if (this.timePrecision === "exact") {
    const validObservedAt =
      this.observedAt instanceof Date &&
      !Number.isNaN(this.observedAt.getTime());

    if (!validObservedAt) {
      this.invalidate("observedAt", "Thời gian exact cần observedAt hợp lệ");
    } else if (this.observedDate !== getVietnamDate(this.observedAt)) {
      this.invalidate(
        "observedDate",
        "Ngày quan sát phải khớp observedAt theo giờ Việt Nam",
      );
    }
  }
});

floodObservationSchema.index({
  floodEventId: 1,
  publishedAt: -1,
  _id: -1,
});

floodObservationSchema.index({
  floodEventId: 1,
  observedAt: -1,
});

const FloodObservation = mongoose.model(
  "FloodObservation",
  floodObservationSchema,
);

export default FloodObservation;
