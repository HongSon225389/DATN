import mongoose from "mongoose";

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const sourceArticleSchema = new mongoose.Schema(
  {
    // URL dùng để nhận diện bài nguồn và chống nhập trùng.
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 2000,
      validate: {
        validator: isValidHttpUrl,
        message: "URL nguồn phải là địa chỉ HTTP/HTTPS hợp lệ",
      },
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },

    publisher: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Tóm tắt cần thiết, không mặc định lưu toàn bộ bài.
    summary: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    // Lần đầu đưa bài vào hệ thống.
    collectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    collectionMethod: {
      type: String,
      enum: ["manual", "automatic"],
      default: "manual",
    },

    // Có giá trị khi Admin nhập bài bằng tay.
    collectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Nhận định ban đầu, chưa phải kết luận để công bố.
    informationType: {
      type: String,
      enum: [
        "flood_report",
        "risk_warning",
        "recession_report",
        "mixed",
        "unknown",
      ],
      default: "unknown",
    },

    // Gợi ý do người nhập hoặc bộ thu thập trích xuất.
    // Chưa tự chuyển thành tọa độ, quan sát hoặc vùng tránh.
    suggestedLocations: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 1000,
        },
      ],
      default: [],
      validate: {
        validator: (values) =>
          values.length <= 100 && values.every((value) => value.length > 0),
        message: "Tối đa 100 mô tả địa điểm, không để mục rỗng",
      },
    },

    // Quá trình lấy dữ liệu và quá trình duyệt là hai việc riêng.
    processingStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    processedAt: {
      type: Date,
      default: null,
    },

    processingError: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    // completed chỉ có nghĩa đã xử lý trích xuất,
    // không đồng nghĩa Admin đã chấp nhận.
    reviewStatus: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
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
  },
  {
    timestamps: true,
    collection: "sourceArticles",
    versionKey: "revision",
    optimisticConcurrency: true,
  },
);

sourceArticleSchema.pre("validate", function () {
  // Kiểm tra nguồn nhập.
  if (this.collectionMethod === "manual" && !this.collectedBy) {
    this.invalidate("collectedBy", "Bài nhập thủ công cần người nhập");
  }

  // Kiểm tra kết quả xử lý nội dung.
  if (this.processingStatus === "pending") {
    if (this.processedAt || this.processingError) {
      this.invalidate(
        "processingStatus",
        "Bài chờ xử lý chưa có kết quả xử lý",
      );
    }
  }

  if (this.processingStatus === "completed") {
    if (!this.processedAt || this.processingError) {
      this.invalidate(
        "processingStatus",
        "Xử lý thành công cần thời gian và không có lỗi",
      );
    }
  }

  if (this.processingStatus === "failed") {
    if (!this.processedAt || !this.processingError?.trim()) {
      this.invalidate(
        "processingError",
        "Xử lý thất bại cần thời gian và lý do",
      );
    }
  }

  // Kiểm tra quyết định của Admin.
  if (this.reviewStatus === "pending") {
    if (this.reviewedBy || this.reviewedAt || this.reviewNote) {
      this.invalidate(
        "reviewStatus",
        "Tin chờ duyệt chưa có quyết định kiểm duyệt",
      );
    }
  } else {
    if (!this.reviewedBy || !this.reviewedAt) {
      this.invalidate(
        "reviewedBy",
        "Tin đã duyệt cần người duyệt và thời gian",
      );
    }
  }

  if (this.reviewStatus === "rejected" && !this.reviewNote?.trim()) {
    this.invalidate("reviewNote", "Bác bỏ tin cần có lý do");
  }
});

sourceArticleSchema.index({
  reviewStatus: 1,
  collectedAt: -1,
});

sourceArticleSchema.index({
  processingStatus: 1,
  collectedAt: 1,
});

const SourceArticle = mongoose.model("SourceArticle", sourceArticleSchema);

export default SourceArticle;
