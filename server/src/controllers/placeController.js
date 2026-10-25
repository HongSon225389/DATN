import geocodingService from "../services/geocodingService.js";

// GET /api/places/search?q=...
const searchPlaces = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (typeof q !== "string" || q.trim().length < 3 || q.trim().length > 200) {
      return res.status(400).json({
        message: "Địa chỉ tìm kiếm phải có từ 3 đến 200 ký tự",
      });
    }

    const data = await geocodingService.searchPlaces(q.trim());

    return res.status(200).json({
      count: data.length,
      data,
    });
  } catch (error) {
    if ([502, 503].includes(error.status)) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

    return next(error);
  }
};

export default {
  searchPlaces,
};
