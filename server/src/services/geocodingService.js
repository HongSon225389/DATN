const cache = new Map();

const normalizeText = (value) => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const getSearchTerms = (query) => {
  const primaryPart = query.split(",")[0];

  const normalized = normalizeText(primaryPart)
    .replace(/\b(?:ha noi|hanoi|viet nam|vietnam)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Giữ "đại học" để phân biệt trường với chợ/nhà khách cùng tên.
  const ignoredWords = new Set(["duong", "pho", "ngo", "ngach", "hem", "so"]);

  return [
    ...new Set(
      normalized.split(" ").filter((word) => word && !ignoredWords.has(word)),
    ),
  ];
};

const serviceError = (message, status = 502) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const searchPlaces = async (query) => {
  const searchText = query.trim();
  const terms = getSearchTerms(searchText);

  if (terms.length === 0) {
    return [];
  }

  const cacheKey = normalizeText(searchText);
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  cache.delete(cacheKey);

  const url = new URL("https://photon.komoot.io/api/");

  // Gửi nguyên truy vấn, giữ dấu tiếng Việt.
  url.searchParams.set("q", searchText);
  url.searchParams.set("limit", "10");
  url.searchParams.set("lat", "21.0285");
  url.searchParams.set("lon", "105.835");

  let result;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Photon HTTP:", response.status);

      throw serviceError(
        response.status === 429
          ? "Dịch vụ tìm địa chỉ đang giới hạn yêu cầu. Vui lòng thử lại sau"
          : "Dịch vụ tìm địa chỉ chưa khả dụng",
        503,
      );
    }

    result = await response.json();
  } catch (error) {
    if (error.status) throw error;

    throw serviceError("Không kết nối được dịch vụ tìm địa chỉ");
  }

  if (!Array.isArray(result.features)) {
    throw serviceError("Dịch vụ trả dữ liệu địa chỉ không hợp lệ");
  }

  const data = [];
  const seen = new Set();

  for (const feature of result.features) {
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties || {};

    if (
      feature.geometry?.type !== "Point" ||
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      !coordinates.every(Number.isFinite)
    ) {
      continue;
    }

    const [lng, lat] = coordinates;

    // Khung bao quanh Hà Nội, không phải ranh giới hành chính.
    if (lng < 105.2 || lng > 106.1 || lat < 20.5 || lat > 21.5) {
      continue;
    }

    const countryCode = String(properties.countrycode || "").toLowerCase();

    if (countryCode && countryCode !== "vn") {
      continue;
    }

    const candidateWords = new Set(
      normalizeText(
        [properties.name, properties.housenumber, properties.street]
          .filter(Boolean)
          .join(" "),
      ).split(" "),
    );

    if (!terms.every((term) => candidateWords.has(term))) {
      continue;
    }

    const id = properties.osm_id
      ? `photon:${properties.osm_type}:${properties.osm_id}`
      : `photon:${lng},${lat}`;

    if (seen.has(id)) continue;

    seen.add(id);

    const streetAddress = [properties.housenumber, properties.street]
      .filter(Boolean)
      .join(" ");

    const addressParts = [
      properties.name,
      streetAddress,
      properties.district,
      properties.city,
      properties.state,
      properties.country,
    ].filter(Boolean);

    const address = [...new Set(addressParts)].join(", ");

    data.push({
      id,
      name: properties.name || streetAddress || searchText,
      address: address || searchText,
      coordinates: [lng, lat],
      layer:
        properties.osm_value || (properties.housenumber ? "address" : "place"),
    });

    if (data.length >= 5) break;
  }

  if (cache.size >= 100) {
    cache.delete(cache.keys().next().value);
  }

  cache.set(cacheKey, {
    data,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return data;
};

export default {
  searchPlaces,
};
