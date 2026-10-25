import { useEffect, useState } from "react";

import floodReportService from "../services/floodReportService";

export default function ReportImage({ reportId, index, token }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;

    const load = async () => {
      try {
        const blob = await floodReportService.getReportImage({
          id: reportId,
          index,
          token,
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        if (!controller.signal.aborted) {
          setError("Chưa tải được ảnh.");
        }
      }
    };

    load();

    return () => {
      controller.abort();

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reportId, index, token, retryKey]);

  if (error) {
    return (
      <div className="report-image-error">
        <p role="status">{error}</p>
        <button
          type="button"
          className="refresh-button"
          onClick={() => {
            setError("");
            setUrl("");
            setRetryKey((value) => value + 1);
          }}
        >
          Tải lại ảnh
        </button>
      </div>
    );
  }

  if (!url) {
    return <p role="status">Đang tải ảnh {index + 1}…</p>;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        className="report-detail-image"
        src={url}
        alt={`Ảnh hiện trường ${index + 1}`}
      />
    </a>
  );
}
