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

    sourceArticleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SourceArticle",
      required: true,
    },

    status: {
      type: String,
      enum: ["flooded", "receded"],
      required: true,
    },

    // Chỉ điền khi biết thời điểm cụ thể.
    observedAt: {
      type: Date,
      default: null,
    },

    // Ngày tại Việt Nam, dùng khi nguồn chỉ đủ rõ tới ngày.
    observedDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    timePrecision: {
      type: String,
      enum: ["day", "exact"],
      required: true,
    },

    timeNote: {
      type: String,
      trim: true,
      default: "",
    },

    // Nếu nguồn cho một số, min và max bằng nhau.
    // Nếu cho khoảng, giữ nguyên hai đầu khoảng.
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
      enum: ["unknown", "source_reported"],
      default: "unknown",
    },

    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "floodObservations",
  },
);

// Kiểm tra sự nhất quán giữa các trường.
floodObservationSchema.pre("validate", function () {
  if (this.timePrecision === "exact" && !this.observedAt) {
    this.invalidate("observedAt", "Thời gian exact cần observedAt");
  }

  if (this.timePrecision === "day" && this.observedAt != null) {
    this.invalidate("observedAt", "Chỉ rõ ngày thì observedAt phải để null");
  }

  const hasMin = this.depthMinCm != null;
  const hasMax = this.depthMaxCm != null;

  if (hasMin !== hasMax) {
    this.invalidate(
      "depthMinCm",
      "Cần có đủ hai đầu khoảng độ sâu hoặc để cả hai null",
    );
  }

  if (hasMin && hasMax && this.depthMinCm > this.depthMaxCm) {
    this.invalidate(
      "depthMaxCm",
      "Độ sâu tối đa phải lớn hơn hoặc bằng tối thiểu",
    );
  }

  if (this.depthMethod === "unknown" && (hasMin || hasMax)) {
    this.invalidate("depthMethod", "Độ sâu unknown không được chứa giá trị");
  }

  if (this.depthMethod === "source_reported" && (!hasMin || !hasMax)) {
    this.invalidate("depthMethod", "Độ sâu theo nguồn cần có giá trị");
  }
});

floodObservationSchema.index({
  floodEventId: 1,
  observedDate: -1,
  observedAt: -1,
});

const FloodObservation = mongoose.model(
  "FloodObservation",
  floodObservationSchema,
);

export default FloodObservation;
