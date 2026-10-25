const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const getFloodEvents = async ({ signal } = {}) => {
  const response = await fetch(`${API_BASE_URL}/flood-events`, {
    signal,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Không tải được dữ liệu: HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!Array.isArray(result.data)) {
    throw new Error("Dữ liệu API không đúng định dạng");
  }

  return {
    data: result.data,
    truncated: result.truncated === true,
  };
};

export default {
  getFloodEvents,
};
