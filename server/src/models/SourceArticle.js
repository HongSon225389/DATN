import mongoose from "mongoose";

const sourceArticleSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (value) => {
          try {
            const url = new URL(value);
            return ["http:", "https:"].includes(url.protocol);
          } catch {
            return false;
          }
        },
        message: "URL nguồn không hợp lệ",
      },
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    publisher: {
      type: String,
      required: true,
      trim: true,
    },

    publishedAt: {
      type: Date,
      default: null,
    },

    collectedAt: {
      type: Date,
      default: Date.now,
    },

    collectionMethod: {
      type: String,
      enum: ["manual", "automatic"],
      default: "manual",
    },
  },
  {
    timestamps: true,
    collection: "sourceArticles",
  },
);

const SourceArticle = mongoose.model("SourceArticle", sourceArticleSchema);

export default SourceArticle;
