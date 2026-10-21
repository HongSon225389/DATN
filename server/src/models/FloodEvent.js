import mongoose from "mongoose";

const floodEventSchema = new mongoose.Schema(
  {
    // Mã sự kiện duy nhất.
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Chuẩn bị mở rộng địa bàn sau này.
    regionCode: {
      type: String,
      required: true,
      default: "HN",
      trim: true,
      uppercase: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Địa chỉ hoặc mốc nhận diện hiển thị cho người dân.
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    // Điểm đại diện để hiển thị trên bản đồ.
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

    // Ghi chú nội bộ, không cần trả ra API công khai.
    locationNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    dataMode: {
      type: String,
      enum: ["current", "historical"],
      required: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
    },

    // Quan sát đang được dùng làm thông tin hiện hành.
    latestObservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodObservation",
      default: null,
    },

    // Lần đầu Admin công bố sự kiện.
    publishedAt: {
      type: Date,
      default: null,
    },

    // Lần gần nhất Admin công bố cập nhật tình trạng.
    lastStatusPublishedAt: {
      type: Date,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "floodEvents",

    // Dùng cho kiểm soát cập nhật đồng thời qua document.save().
    versionKey: "revision",
    optimisticConcurrency: true,
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
