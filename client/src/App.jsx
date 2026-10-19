import { useEffect, useState } from "react";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

export default function App() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Backend trả về lỗi ${response.status}`);
        }

        const data = await response.json();
        setHealth(data);
      } catch (error) {
        if (error.name !== "AbortError") {
          setError(
            "Không kết nối được backend. Kiểm tra server và cấu hình API.",
          );
        }
      }
    }

    checkBackend();

    return () => controller.abort();
  }, []);

  return (
    <main className="page">
      <span className="badge">Đồ án tốt nghiệp</span>

      <h1>Bản đồ ngập và hỗ trợ tìm đường tại Hà Nội</h1>

      <p className="description">
        Tổng hợp thông tin có nguồn và hỗ trợ tìm đường tránh khu vực ngập đã
        được kiểm duyệt.
      </p>

      <section className="panel">
        <h2>Trạng thái hệ thống</h2>

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : health ? (
          <dl>
            <div>
              <dt>Backend</dt>
              <dd>Đã kết nối</dd>
            </div>

            <div>
              <dt>MongoDB</dt>
              <dd>
                {health.database === "connected"
                  ? "Đã kết nối"
                  : "Chưa kết nối"}
              </dd>
            </div>
          </dl>
        ) : (
          <p>Đang kiểm tra kết nối…</p>
        )}
      </section>

      <p className="note">
        Giai đoạn hiện tại: khởi tạo nền tảng. Chưa cung cấp dữ liệu ngập hoặc
        chức năng tìm đường.
      </p>
    </main>
  );
}
