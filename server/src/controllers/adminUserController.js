import mongoose from "mongoose";

import User from "../models/User.js";
import FloodReport from "../models/FloodReport.js";

const readPagination = (query) => {
  const pageText = query.page ?? "1";
  const limitText = query.limit ?? "10";

  if (
    typeof pageText !== "string" ||
    !/^[1-9]\d*$/.test(pageText) ||
    typeof limitText !== "string" ||
    !["10", "20"].includes(limitText)
  ) {
    return null;
  }

  const page = Number(pageText);
  const limit = Number(limitText);
  const skip = (page - 1) * limit;

  if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
    return null;
  }

  return { page, limit, skip };
};

const formatUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  isActive: user.isActive,
  blockedReason: user.blockedReason ?? null,
  blockedAt: user.blockedAt ?? null,
  createdAt: user.createdAt,
});

// GET /api/admin/users
const getUsers = async (req, res, next) => {
  try {
    const pagination = readPagination(req.query);

    if (!pagination) {
      return res.status(400).json({
        message: "page phải là số nguyên dương; limit nhận 10 hoặc 20",
      });
    }

    const q = req.query.q ?? "";
    const active = req.query.active;

    if (typeof q !== "string" || q.trim().length > 200) {
      return res.status(400).json({
        message: "Từ khóa không hợp lệ hoặc vượt quá 200 ký tự",
      });
    }

    if (active !== undefined && !["true", "false"].includes(active)) {
      return res.status(400).json({
        message: "active chỉ nhận true hoặc false",
      });
    }

    // Chỉ quản lý tài khoản người dùng, không đưa Admin vào danh sách.
    const filter = { role: "user" };

    if (active !== undefined) {
      filter.isActive = active === "true";
    }

    if (q.trim()) {
      const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
      ];
    }

    const { page, limit, skip } = pagination;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("name email isActive blockedReason blockedAt createdAt")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    const ids = users.map((user) => user._id);

    const reportCounts = ids.length
      ? await FloodReport.aggregate([
          { $match: { userId: { $in: ids } } },
          {
            $group: {
              _id: "$userId",
              total: { $sum: 1 },
              pending: {
                $sum: {
                  $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
                },
              },
              approved: {
                $sum: {
                  $cond: [{ $eq: ["$status", "approved"] }, 1, 0],
                },
              },
              rejected: {
                $sum: {
                  $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
                },
              },
            },
          },
        ])
      : [];

    const countMap = new Map(
      reportCounts.map((item) => [item._id.toString(), item]),
    );

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: users.map((user) => {
        const counts = countMap.get(user._id.toString());

        return {
          ...formatUser(user),
          reports: {
            total: counts?.total ?? 0,
            pending: counts?.pending ?? 0,
            approved: counts?.approved ?? 0,
            rejected: counts?.rejected ?? 0,
          },
        };
      }),
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/admin/users/:id/status
const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const { isActive, reason } = body;

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "Mã người dùng không hợp lệ",
      });
    }

    if (
      Object.keys(body).some((key) => !["isActive", "reason"].includes(key)) ||
      typeof isActive !== "boolean"
    ) {
      return res.status(400).json({
        message: "Dữ liệu thay đổi trạng thái không hợp lệ",
      });
    }

    if (
      !isActive &&
      (typeof reason !== "string" ||
        !reason.trim() ||
        reason.trim().length > 500)
    ) {
      return res.status(400).json({
        message: "Lý do khóa phải có từ 1 đến 500 ký tự",
      });
    }

    const user = await User.findOneAndUpdate(
      {
        _id: id,
        role: "user",
        // Chỉ cập nhật nếu trạng thái chưa phải trạng thái yêu cầu.
        isActive: !isActive,
      },
      {
        $set: {
          isActive,
          blockedReason: isActive ? null : reason.trim(),
          blockedAt: isActive ? null : new Date(),
          blockedBy: isActive ? null : req.user._id,
        },
        // Token cũ mất hiệu lực cả khi tài khoản được mở khóa.
        $inc: {
          tokenVersion: 1,
        },
        $unset: {
          passwordResetTokenHash: "",
          passwordResetExpiresAt: "",
          passwordResetRequestedAt: "",
        },
      },
      {
        new: true,
        runValidators: true,
      },
    )
      .select("name email isActive blockedReason blockedAt createdAt")
      .lean();

    if (!user) {
      const exists = await User.exists({
        _id: id,
        role: "user",
      });

      return res.status(exists ? 409 : 404).json({
        message: exists
          ? "Trạng thái tài khoản đã thay đổi. Vui lòng tải lại"
          : "Không tìm thấy tài khoản người dùng",
      });
    }

    return res.status(200).json({
      message: isActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản",
      data: formatUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/admin/users/:id/reports
const getUserReports = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pagination = readPagination(req.query);

    if (!mongoose.isObjectIdOrHexString(id)) {
      return res.status(400).json({
        message: "Mã người dùng không hợp lệ",
      });
    }

    if (!pagination) {
      return res.status(400).json({
        message: "Phân trang không hợp lệ",
      });
    }

    const user = await User.findOne({
      _id: id,
      role: "user",
    })
      .select("name email")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "Không tìm thấy người dùng",
      });
    }

    const { page, limit, skip } = pagination;
    const filter = { userId: user._id };

    const [reports, total] = await Promise.all([
      FloodReport.find(filter)
        .select("address status submittedAt reviewNote")
        .sort({ submittedAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      FloodReport.countDocuments(filter),
    ]);

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      data: reports.map((report) => ({
        id: report._id,
        address: report.address,
        status: report.status,
        submittedAt: report.submittedAt,
        reviewNote: report.reviewNote,
      })),
    });
  } catch (error) {
    return next(error);
  }
};

export default {
  getUsers,
  updateUserStatus,
  getUserReports,
};
