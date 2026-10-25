const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const request = async (path, { token, signal }) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không tải được dữ liệu");
    error.status = response.status;
    throw error;
  }

  return result;
};

const getFloodEvents = ({
  token,
  signal,
  page = 1,
  limit = 10,
  q = "",
  mode = "",
  published = "",
}) => {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (q) query.set("q", q);
  if (mode) query.set("mode", mode);
  if (published) query.set("published", published);

  return request(`/admin/flood-events?${query}`, { token, signal });
};

const getFloodEventById = ({ id, token, signal }) => {
  return request(`/admin/flood-events/${encodeURIComponent(id)}`, {
    token,
    signal,
  });
};

const getObservations = ({ id, token, signal, page = 1 }) => {
  return request(
    `/admin/flood-events/${encodeURIComponent(id)}/observations?page=${page}&limit=10`,
    { token, signal },
  );
};

const createFloodEvent = async ({ token, data }) => {
  const response = await fetch(`${API_BASE_URL}/admin/flood-events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...data,
      isPublished: false,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    const details = Array.isArray(result.errors)
      ? result.errors.join("; ")
      : "";

    const error = new Error(
      [result.message || "Không thể tạo bản nháp", details]
        .filter(Boolean)
        .join(": "),
    );

    error.status = response.status;
    throw error;
  }

  return result;
};
const publishFloodEvent = async ({ id, revision, token }) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/flood-events/${encodeURIComponent(id)}/publish`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ revision }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không thể đăng điểm ngập");
    error.status = response.status;
    throw error;
  }

  return result;
};

const saveChanges = async ({ path, method, token, data }) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    const details = Array.isArray(result.errors)
      ? result.errors.join("; ")
      : "";

    const error = new Error(
      [result.message || "Không thể lưu thay đổi", details]
        .filter(Boolean)
        .join(": "),
    );

    error.status = response.status;
    throw error;
  }

  return result;
};

const updateDraft = ({ id, token, data }) => {
  return saveChanges({
    path: `/admin/flood-events/${encodeURIComponent(id)}/draft`,
    method: "PATCH",
    token,
    data,
  });
};

const addObservation = ({ id, token, data }) => {
  return saveChanges({
    path: `/admin/flood-events/${encodeURIComponent(id)}/observations`,
    method: "POST",
    token,
    data,
  });
};

const deleteFloodEvent = ({ id, revision, reason, token }) => {
  return saveChanges({
    path: `/admin/flood-events/${encodeURIComponent(id)}`,
    method: "DELETE",
    token,
    data: {
      revision,
      reason,
    },
  });
};

export default {
  getFloodEvents,
  getFloodEventById,
  getObservations,
  createFloodEvent,
  publishFloodEvent,
  updateDraft,
  addObservation,
  deleteFloodEvent,
};
