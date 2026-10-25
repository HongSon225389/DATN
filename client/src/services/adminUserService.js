const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const request = async (path, { token, signal, method = "GET", data }) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    signal,
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể thực hiện yêu cầu");

    error.status = response.status;
    throw error;
  }

  return result;
};

const getUsers = ({
  token,
  signal,
  page = 1,
  limit = 10,
  q = "",
  active = "",
}) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (q) query.set("q", q);
  if (active !== "") query.set("active", active);

  return request(`/admin/users?${query}`, { token, signal });
};

const updateStatus = ({ id, token, isActive, reason }) => {
  return request(`/admin/users/${encodeURIComponent(id)}/status`, {
    token,
    method: "PATCH",
    data: {
      isActive,
      ...(isActive ? {} : { reason }),
    },
  });
};

const getReports = ({ id, token, signal, page = 1, limit = 10 }) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  return request(`/admin/users/${encodeURIComponent(id)}/reports?${query}`, {
    token,
    signal,
  });
};

export default {
  getUsers,
  updateStatus,
  getReports,
};
