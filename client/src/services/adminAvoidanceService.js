const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const request = async (path, { token, signal, method = "GET", data }) => {
  const response = await fetch(
    `${API_BASE_URL}/admin/routing-avoidances${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(data ? { "Content-Type": "application/json" } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
      signal,
      cache: "no-store",
    },
  );

  const result = await response.json();

  if (!response.ok) {
    const error = new Error(result.message || "Không xử lý được vùng tránh");
    error.status = response.status;
    throw error;
  }

  return result;
};

export default {
  list: ({ eventId, token, signal }) =>
    request(`?eventId=${encodeURIComponent(eventId)}`, {
      token,
      signal,
    }),

  create: ({ token, data }) => request("", { token, method: "POST", data }),

  end: ({ id, revision, token }) =>
    request(`/${encodeURIComponent(id)}/end`, {
      token,
      method: "POST",
      data: { revision },
    }),
};
