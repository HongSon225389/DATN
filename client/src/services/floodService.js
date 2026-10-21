const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const getFloodEvents = async ({ survey = false, signal } = {}) => {
  if (survey && !import.meta.env.DEV) {
    throw new Error("Chế độ khảo sát chỉ dùng trong development");
  }

  const path = survey ? "/dev/flood-events" : "/flood-events";

  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Không tải được dữ liệu: HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!Array.isArray(result.data)) {
    throw new Error("Dữ liệu API không đúng định dạng");
  }

  return result.data;
};

export default {
  getFloodEvents,
};
