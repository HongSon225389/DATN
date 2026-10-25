import { useEffect, useId, useRef, useState } from "react";

import placeService from "../services/placeService";

export default function PlaceSearch({ onSelect, disabled = false }) {
  const inputId = useId();
  const controllerRef = useRef(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    return () => controllerRef.current?.abort();
  }, []);

  const search = async () => {
    const text = query.trim();

    if (disabled || loading) return;

    if (text.length < 3) {
      setError("Nhập ít nhất 3 ký tự");
      return;
    }

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError("");
    setResults([]);
    setSearched(false);

    try {
      const data = await placeService.searchPlaces({
        q: text,
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      setResults(data);
      setSearched(true);
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error.message);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="place-search">
      <label htmlFor={inputId}>Tìm địa chỉ trên bản đồ</label>

      <div className="admin-search-row">
        <input
          id={inputId}
          type="search"
          placeholder="Nhập địa chỉ hoặc tên địa điểm tại Hà Nội"
          maxLength={200}
          value={query}
          disabled={disabled}
          onChange={(event) => {
            controllerRef.current?.abort();
            setQuery(event.target.value);
            setResults([]);
            setError("");
            setSearched(false);
            setLoading(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
        />

        <button
          type="button"
          className="refresh-button"
          disabled={disabled || loading}
          onClick={search}
        >
          {loading ? "Đang tìm…" : "Tìm địa chỉ"}
        </button>
      </div>

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      {searched && results.length === 0 && (
        <p className="field-help" role="status">
          Chưa tìm thấy kết quả khớp. Nếu tìm số nhà, hãy thử tên ngõ hoặc tên
          đường rồi kiểm tra lại vị trí trên bản đồ.
        </p>
      )}

      <ul className="place-results">
        {results.map((place) => (
          <li key={place.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onSelect(place);
                setQuery(place.address);
                setResults([]);
                setSearched(false);
              }}
            >
              <strong>{place.name}</strong>
              <span>{place.address}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
