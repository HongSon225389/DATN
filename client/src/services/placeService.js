const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const searchPlaces = async ({ q, signal }) => {
  const query = new URLSearchParams({ q });

  const response = await fetch(`${API_BASE_URL}/places/search?${query}`, {
    signal,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Không tìm được địa chỉ");
  }

  if (!Array.isArray(result.data)) {
    throw new Error("Dữ liệu địa chỉ không hợp lệ");
  }

  return result.data;
};

export default {
  searchPlaces,
};
