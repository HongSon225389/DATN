const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const createReport = async ({ token, formData }) => {
  const response = await fetch(`${API_BASE_URL}/flood-reports`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // Không tự đặt Content-Type, trình duyệt sẽ thêm boundary.
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    const details = Array.isArray(result.errors)
      ? result.errors.join("; ")
      : "";

    const error = new Error(
      [result.message || "Không gửi được báo cáo", details]
        .filter(Boolean)
        .join(": "),
    );

    error.status = response.status;
    throw error;
  }

  return result;
};
const getReports = async ({
  token,
  admin = false,
  page = 1,
  limit = 10,
  status = "",
  signal,
}) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (status) {
    query.set("status", status);
  }

  const path = admin ? "/admin/flood-reports" : "/flood-reports/mine";

  const response = await fetch(`${API_BASE_URL}${path}?${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
    signal,
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không tải được báo cáo");
    error.status = response.status;
    throw error;
  }

  return result;
};

const getReportById = async ({ id, token, signal }) => {
  const response = await fetch(
    `${API_BASE_URL}/flood-reports/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal,
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không tải được báo cáo");
    error.status = response.status;
    throw error;
  }

  return result.data;
};

const getReportImage = async ({ id, index, token, signal }) => {
  const response = await fetch(
    `${API_BASE_URL}/flood-reports/${encodeURIComponent(id)}/images/${index}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      signal,
    },
  );

  if (!response.ok) {
    const error = new Error("Không tải được ảnh");
    error.status = response.status;
    throw error;
  }

  return response.blob();
};
const rejectReport = async ({ id, revision, reason, token }) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/flood-reports/${encodeURIComponent(id)}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        revision,
        reason,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể từ chối báo cáo");

    error.status = response.status;
    throw error;
  }

  return result;
};

const approveReport = async ({ id, token, data }) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/flood-reports/${encodeURIComponent(id)}/approve`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể duyệt báo cáo");

    error.status = response.status;
    throw error;
  }

  return result;
};
const resubmitReport = async ({ id, token, formData }) => {
  const response = await fetch(
    `${API_BASE_URL}/flood-reports/${encodeURIComponent(id)}/resubmit`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const details = Array.isArray(result.errors)
      ? result.errors.join("; ")
      : "";

    const error = new Error(
      [result.message || "Không thể gửi lại báo cáo", details]
        .filter(Boolean)
        .join(": "),
    );

    error.status = response.status;
    throw error;
  }

  return result;
};
export default {
  createReport,
  getReports,
  getReportById,
  getReportImage,
  rejectReport,
  approveReport,
  resubmitReport,
};
