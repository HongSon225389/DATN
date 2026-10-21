import mongoose from "mongoose";

const floodEventSchema = new mongoose.Schema(
  {
    // Mã ổn định để nhập lại không tạo trùng.
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    regionCode: {
      type: String,
      required: true,
      default: "HN",
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    // Giữ mô tả địa điểm từ nguồn.
    sourceLocationText: {
      type: String,
      required: true,
      trim: true,
    },

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

    locationMethod: {
      type: String,
      enum: ["manual", "source_coordinates", "gps"],
      default: "manual",
    },

    locationReviewStatus: {
      type: String,
      enum: ["needs_review", "reviewed"],
      default: "needs_review",
    },

    locationNote: {
      type: String,
      trim: true,
      default: "",
    },

    dataMode: {
      type: String,
      enum: ["historical", "current"],
      required: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    latestObservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodObservation",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "floodEvents",
  },
);

floodEventSchema.index({ location: "2dsphere" });
floodEventSchema.index({
  regionCode: 1,
  dataMode: 1,
  isPublished: 1,
});

const FloodEvent = mongoose.model("FloodEvent", floodEventSchema);

export default FloodEvent;
