const notFound = (req, res) => {
  return res.status(404).json({
    message: "API không tồn tại",
  });
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  console.error("Lỗi xử lý request:", error);

  const isClientError =
    Number.isInteger(error.status) && error.status >= 400 && error.status < 500;

  const statusCode = isClientError ? error.status : 500;

  return res.status(statusCode).json({
    message:
      statusCode === 400
        ? "Dữ liệu gửi lên không hợp lệ"
        : "Có lỗi xảy ra khi xử lý yêu cầu",
  });
};

export default {
  notFound,
  errorHandler,
};
