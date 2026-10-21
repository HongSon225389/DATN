import mongoose from "mongoose";

// GeoJSON dùng [kinh độ, vĩ độ].
const isValidPosition = (position) => {
  return (
    Array.isArray(position) &&
    position.length === 2 &&
    Number.isFinite(position[0]) &&
    Number.isFinite(position[1]) &&
    position[0] >= -180 &&
    position[0] <= 180 &&
    position[1] >= -90 &&
    position[1] <= 90
  );
};

const isValidPolygonCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 1) {
    return false;
  }

  // Bản đầu chỉ nhận polygon một vòng, không có lỗ bên trong.
  const ring = coordinates[0];

  if (
    !Array.isArray(ring) ||
    ring.length < 4 ||
    ring.length > 501 ||
    !ring.every(isValidPosition)
  ) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];

  // GeoJSON yêu cầu điểm đầu và cuối trùng nhau.
  if (first[0] !== last[0] || first[1] !== last[1]) {
    return false;
  }

  const distinctPoints = new Set(
    ring.slice(0, -1).map((position) => position.join(",")),
  );

  return distinctPoints.size >= 3;
};

const routingAvoidanceSchema = new mongoose.Schema(
  {
    floodEventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FloodEvent",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    geometry: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
        default: "Polygon",
      },

      coordinates: {
        type: [[[Number]]],
        required: true,
        validate: {
          validator: isValidPolygonCoordinates,
          message:
            "Polygon cần một vòng khép kín, ít nhất 3 đỉnh khác nhau và tối đa 500 đỉnh",
        },
      },
    },

    // Chuẩn bị mở rộng phương tiện.
    // Hiện chỉ cho API tìm đường sử dụng car.
    vehicleTypes: {
      type: [
        {
          type: String,
          enum: ["car", "motorcycle", "walking"],
        },
      ],
      default: ["car"],
      validate: {
        validator: (values) =>
          values.length >= 1 && new Set(values).size === values.length,
        message: "Cần ít nhất một phương tiện, không được lặp",
      },
    },

    // Admin cho phép áp dụng hay không.
    // Chưa đủ để kết luận vùng đang có hiệu lực.
    isActive: {
      type: Boolean,
      default: false,
    },

    validFrom: {
      type: Date,
      required: true,
    },

    // Đến mốc này phải rà soát lại trước khi tiếp tục áp dụng.
    reviewAt: {
      type: Date,
      required: true,
    },

    // Kết thúc áp dụng trước hạn khi có thông tin mới.
    endedAt: {
      type: Date,
      default: null,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    endedReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "routingAvoidances",
    versionKey: "revision",
    optimisticConcurrency: true,
  },
);

routingAvoidanceSchema.pre("validate", function () {
  const validDate = (value) =>
    value instanceof Date && !Number.isNaN(value.getTime());

  if (
    validDate(this.validFrom) &&
    validDate(this.reviewAt) &&
    this.reviewAt <= this.validFrom
  ) {
    this.invalidate("reviewAt", "Thời điểm rà soát phải sau thời điểm bắt đầu");
  }

  if (this.endedAt != null) {
    if (
      validDate(this.endedAt) &&
      validDate(this.validFrom) &&
      this.endedAt < this.validFrom
    ) {
      this.invalidate(
        "endedAt",
        "Thời điểm kết thúc không được trước thời điểm bắt đầu",
      );
    }

    if (this.isActive) {
      this.invalidate("isActive", "Vùng đã kết thúc phải được tắt");
    }

    if (!this.endedBy || !this.endedReason?.trim()) {
      this.invalidate(
        "endedReason",
        "Kết thúc vùng tránh cần người thực hiện và lý do",
      );
    }
  } else if (this.endedBy || this.endedReason) {
    this.invalidate("endedAt", "Thông tin kết thúc cần có thời điểm kết thúc");
  }
});

routingAvoidanceSchema.index({ geometry: "2dsphere" });

routingAvoidanceSchema.index({
  floodEventId: 1,
});

routingAvoidanceSchema.index({
  isActive: 1,
  endedAt: 1,
  vehicleTypes: 1,
  reviewAt: 1,
});

const RoutingAvoidance = mongoose.model(
  "RoutingAvoidance",
  routingAvoidanceSchema,
);

export default RoutingAvoidance;
