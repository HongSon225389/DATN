import mongoose from "mongoose";

// Cấu trúc ảnh dùng cho nội dung hiện tại và lịch sử.
const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },

    storageKey: {
      type: String,
      required: true,
      trim: true,
    },

    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
    },

    mimeType: {
      type: String,
      required: true,
      enum: ["image/jpeg", "image/png", "image/webp"],
    },

    width: {
      type: Number,
      required: true,
      min: 1,
    },

    height: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  },
);

// Các trường nội dung báo cáo.
const reportContentFields = {
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
      default: "Point",
    },

    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.length === 2 &&
          Number.isFinite(value[0]) &&
          Number.isFinite(value[1]) &&
          value[0] >= -180 &&
          value[0] <= 180 &&
          value[1] >= -90 &&
          value[1] <= 90,
        message: "Tọa độ phải là [kinh độ, vĩ độ] hợp lệ",
      },
    },
  },

  address: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },

  description: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: (value) =>
        typeof value === "string" && value.trim().split(/\s+/).length <= 200,
      message: "Mô tả không được vượt quá 200 từ tách bằng khoảng trắng",
    },
  },

  images: {
    type: [imageSchema],
    default: [],
    validate: {
      validator: (value) =>
        Array.isArray(value) && value.length >= 1 && value.length <= 3,
      message: "Báo cáo cần từ 1 đến 3 ảnh",
    },
  },

  // Thời điểm User quan sát, không phải thời điểm gửi.
  observedAt: {
    type: Date,
    required: true,
  },

  // Giá trị User tự khai, chưa phải số đo xác minh.
  estimatedDepthCm: {
    type: Number,
    min: 0,
    default: null,
    validate: {
      validator: (value) => value == null || Number.isFinite(value),
      message: "Độ sâu ước lượng không hợp lệ",
    },
  },
};

// Bản chụp nội dung ở mỗi lần gửi hoặc xử lý.
// Không tham chiếu ngược tới nội dung hiện tại.
const reportSnapshotSchema = new mongoose.Schema(reportContentFields, {
  _id: false,
});

const reportHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["submitted", "resubmitted", "approved", "rejected"],
      required: true,
    },

    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    actedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Lý do bác bỏ hoặc ghi chú xử lý.
    note: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    snapshot: {
      type: reportSnapshotSchema,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const floodReportSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },

    ...reportContentFields,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Lần gửi gần nhất, bao gồm gửi lại sau khi bị bác bỏ.
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // Chỉ có khi đã chấp nhận và tạo/cập nhật thông tin ngập.
    floodEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodEvent",
      default: null,
    },

    floodObservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodObservation",
      default: null,
    },

    history: {
      type: [reportHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "floodReports",
    versionKey: "revision",
    optimisticConcurrency: true,
  },
);

floodReportSchema.pre("validate", function () {
  // Không chấp nhận thời điểm quan sát sau thời điểm gửi.
  if (
    this.observedAt instanceof Date &&
    this.submittedAt instanceof Date &&
    this.observedAt > this.submittedAt
  ) {
    this.invalidate(
      "observedAt",
      "Thời điểm quan sát không được sau thời điểm gửi báo cáo",
    );
  }

  if (this.status === "pending") {
    if (this.reviewedBy || this.reviewedAt || this.reviewNote) {
      this.invalidate(
        "status",
        "Báo cáo chờ duyệt không chứa kết quả duyệt hiện tại",
      );
    }
  }

  if (["approved", "rejected"].includes(this.status)) {
    if (!this.reviewedBy || !this.reviewedAt) {
      this.invalidate(
        "reviewedBy",
        "Báo cáo đã xử lý cần người duyệt và thời gian duyệt",
      );
    }
  }

  if (this.status === "rejected" && !this.reviewNote?.trim()) {
    this.invalidate("reviewNote", "Bác bỏ báo cáo phải có lý do");
  }

  if (this.status === "approved") {
    if (!this.floodEventId || !this.floodObservationId) {
      this.invalidate(
        "floodEventId",
        "Báo cáo được duyệt cần liên kết sự kiện và quan sát",
      );
    }
  } else if (this.floodEventId || this.floodObservationId) {
    this.invalidate(
      "status",
      "Báo cáo chưa được duyệt không có liên kết công bố",
    );
  }
});

floodReportSchema.index({
  userId: 1,
  createdAt: -1,
});

floodReportSchema.index({
  status: 1,
  submittedAt: 1,
});

const FloodReport = mongoose.model("FloodReport", floodReportSchema);

export default FloodReport;
