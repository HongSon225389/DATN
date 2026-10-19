export const HANOI_CENTER = [21.023, 105.835];

export const STATUS = {
  flooded: { label: "Đang ngập", color: "#dc3545" },
  stale: { label: "Cần cập nhật", color: "#64748b" },
  receded: { label: "Đã rút", color: "#16856b" },
};

export const floodPoints = [
  {
    id: "f1",
    name: "Khu vực phố Thái Hà",
    address: "Thái Hà, Hà Nội",
    position: [21.012, 105.819],
    status: "flooded",
    depthCm: 25,
    time: "14:30 ngày 19/10/2026",
    description: "Tình huống mẫu: nước đọng tại một đoạn đường.",
  },
  {
    id: "f2",
    name: "Khu vực Nguyễn Khuyến",
    address: "Nguyễn Khuyến, Hà Nội",
    position: [21.025, 105.842],
    status: "flooded",
    depthCm: null,
    time: "14:15 ngày 19/10/2026",
    description: "Tình huống mẫu: có ghi nhận ngập, chưa có thông tin độ sâu.",
  },
  {
    id: "f3",
    name: "Khu vực Trung Kính",
    address: "Trung Kính, Hà Nội",
    position: [21.016, 105.794],
    status: "stale",
    depthCm: 20,
    time: "09:00 ngày 18/10/2026",
    description:
      "Tình huống mẫu: thông tin đã cũ, chưa có cập nhật tình trạng mới.",
  },
  {
    id: "f4",
    name: "Khu vực Giải Phóng",
    address: "Giải Phóng, Hà Nội",
    position: [20.999, 105.842],
    status: "receded",
    depthCm: 0,
    time: "15:00 ngày 19/10/2026",
    description: "Tình huống mẫu: đã có cập nhật xác nhận nước rút.",
  },
];

export const places = [
  {
    id: "p1",
    name: "Hồ Hoàn Kiếm",
    address: "Hà Nội",
    position: [21.0287, 105.8524],
  },
  {
    id: "p2",
    name: "Đại học Bách khoa Hà Nội",
    address: "Khu vực Đại Cồ Việt, Hà Nội",
    position: [21.005, 105.8431],
  },
  {
    id: "p3",
    name: "Văn Miếu",
    address: "Quốc Tử Giám, Hà Nội",
    position: [21.0281, 105.8355],
  },
  ...floodPoints,
];

// Chỉ là nét vẽ minh họa cho cặp địa điểm p1 → p2.
// Không phải kết quả của bộ định tuyến.
export const sampleRoutes = {
  normal: [
    [21.0287, 105.8524],
    [21.024, 105.851],
    [21.017, 105.85],
    [21.01, 105.847],
    [21.005, 105.8431],
  ],
  avoidance: [
    [21.0287, 105.8524],
    [21.028, 105.859],
    [21.016, 105.86],
    [21.005, 105.854],
    [21.005, 105.8431],
  ],
};

export function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
