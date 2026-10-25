const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const findRoute = async ({ start, end, avoidFloods, signal }) => {
  const response = await fetch(`${API_BASE_URL}/routes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      start,
      end,
      vehicle: "car",
      avoidFloods,
    }),
    signal,
    cache: "no-store",
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Không thể tìm đường");
  }

  if (
    result.data?.geometry?.type !== "LineString" ||
    !Array.isArray(result.data.geometry.coordinates)
  ) {
    throw new Error("Dữ liệu tuyến không hợp lệ");
  }

  return result.data;
};

export default {
  findRoute,
};
