import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../src/config/db.js";
import SourceArticle from "../src/models/SourceArticle.js";
import FloodEvent from "../src/models/FloodEvent.js";
import FloodObservation from "../src/models/FloodObservation.js";

dotenv.config({
  path: new URL("../.env", import.meta.url),
  quiet: true,
});

const sourceUrl =
  "https://baotintuc.vn/ha-noi/ha-noi-82-diem-ngap-ung-huy-dong-toi-da-luc-luong-tieu-thoat-nuoc-20250930193603354.htm";

const surveyItems = [
  {
    code: "KS01",
    title: "Ngập khu vực Trần Bình",
    sourceLocationText: "Trần Bình: UBND phường Mai Dịch đến bệnh viện 19/8",
    coordinates: [105.778808, 21.035763],
    locationNote:
      "Điểm tham khảo gần UBND phường Mai Dịch; chưa xác định toàn bộ đoạn ảnh hưởng.",
  },
  {
    code: "KS02",
    title: "Ngập khu vực Bùi Xương Trạch",
    sourceLocationText: "Bùi Xương Trạch: số nhà 49 đến số nhà 93",
    coordinates: [105.817528, 20.990586],
    locationNote:
      "Điểm đại diện trên phố; cần đối chiếu lại đoạn số nhà 49–93.",
  },
  {
    code: "KS03",
    title: "Ngập khu vực Hoa Bằng",
    sourceLocationText: "Hoa Bằng: khu vực ngõ 99",
    coordinates: [105.795824, 21.025275],
    locationNote:
      "Điểm đại diện gần giao phố Hoa Bằng và ngõ 99; chưa xác định phạm vi ngập.",
  },
  {
    code: "KS04",
    title: "Ngập khu vực Nguyễn Khuyến",
    sourceLocationText: "Nguyễn Khuyến: trước cổng trường Lý Thường Kiệt",
    coordinates: [105.838246, 21.028388],
    locationNote:
      "Điểm trên phố sát khuôn viên trường; chưa xác nhận đúng vị trí cổng.",
  },
  {
    code: "KS05",
    title: "Ngập khu vực Phan Văn Trường",
    sourceLocationText: "Phan Văn Trường: cổng chợ đến doanh trại quân đội",
    coordinates: [105.786141, 21.039501],
    locationNote:
      "Điểm tham khảo gần khu Binh chủng Hóa học; cần xác định hai mốc của đoạn.",
  },
];

const seedFloodSurvey = async () => {
  try {
    await connectDB();

    // Tạo collection và unique index trước khi nhập.
    await SourceArticle.init();
    await FloodEvent.init();
    await FloodObservation.init();

    await mongoose.connection.transaction(async (session) => {
      let article = await SourceArticle.findOne({
        url: sourceUrl,
      }).session(session);

      if (!article) {
        article = new SourceArticle({
          url: sourceUrl,
          title:
            "Hà Nội: 82 điểm ngập úng, huy động tối đa lực lượng tiêu thoát nước",
          publisher: "Báo Tin tức - TTXVN",
          publishedAt: new Date("2025-09-30T19:38:00+07:00"),
          collectionMethod: "manual",
        });

        await article.save({ session });
      }

      for (const item of surveyItems) {
        const eventCode = `HN-20250930-${item.code}`;
        const observationCode = `${eventCode}-OBS01`;

        let event = await FloodEvent.findOne({
          code: eventCode,
        }).session(session);

        if (!event) {
          event = new FloodEvent({
            code: eventCode,
            regionCode: "HN",
            title: item.title,
            sourceLocationText: item.sourceLocationText,
            location: {
              type: "Point",
              coordinates: item.coordinates,
            },
            locationMethod: "manual",
            locationReviewStatus: "needs_review",
            locationNote: item.locationNote,
            dataMode: "historical",
            isPublished: false,
          });

          await event.save({ session });
        }

        let observation = await FloodObservation.findOne({
          code: observationCode,
        }).session(session);

        if (!observation) {
          observation = new FloodObservation({
            code: observationCode,
            floodEventId: event._id,
            sourceArticleId: article._id,
            status: "flooded",
            observedAt: null,
            observedDate: "2025-09-30",
            timePrecision: "day",
            timeNote:
              "Nguồn ghi nhận trong ngày 30/9/2025; chưa xác định giờ riêng cho địa điểm.",
            depthMinCm: null,
            depthMaxCm: null,
            depthMethod: "unknown",
            note: "Bản ghi khảo sát lịch sử, chưa công bố và không dùng chặn tuyến hiện tại.",
          });

          await observation.save({ session });
        }

        // Không ghi đè tham chiếu nếu sau này đã có quan sát mới.
        if (!event.latestObservationId) {
          event.latestObservationId = observation._id;
          await event.save({ session });
        }
      }
    });

    const eventCodes = surveyItems.map((item) => `HN-20250930-${item.code}`);

    const events = await FloodEvent.find({
      code: { $in: eventCodes },
    })
      .populate("latestObservationId")
      .sort({ code: 1 })
      .lean();

    console.table(
      events.map((event) => ({
        code: event.code,
        title: event.title,
        mode: event.dataMode,
        published: event.isPublished,
        observationDate: event.latestObservationId?.observedDate || "",
      })),
    );

    console.log("Hoàn tất nhập 5 sự kiện khảo sát.");
    console.log("Chạy lại sẽ không tạo trùng hoặc ghi đè dữ liệu đã có.");
  } catch (error) {
    console.error("Nhập dữ liệu thất bại:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedFloodSurvey();
