import { useState } from "react";
import HanoiMap from "./components/HanoiMap";

export default function App() {
  const [selectedPosition, setSelectedPosition] = useState(null);

  return (
    <div className="app">
      <header className="header">
        <div>
          <strong>Hanoi Flood</strong>
          <span>Bản đồ thông tin ngập tại Hà Nội</span>
        </div>

        <small>Đang phát triển</small>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">KHU VỰC THÍ ĐIỂM</p>
          <h1>Hà Nội</h1>

          <p>
            Bấm lên bản đồ để chọn vị trí phục vụ khảo sát dữ liệu và thử nghiệm
            định tuyến.
          </p>

          <section className="location-card">
            <h2>Vị trí đã chọn</h2>

            {selectedPosition ? (
              <>
                <dl>
                  <div>
                    <dt>Vĩ độ</dt>
                    <dd>{selectedPosition.lat.toFixed(6)}</dd>
                  </div>

                  <div>
                    <dt>Kinh độ</dt>
                    <dd>{selectedPosition.lng.toFixed(6)}</dd>
                  </div>
                </dl>

                <label htmlFor="coordinates">GeoJSON: kinh độ, vĩ độ</label>

                <input
                  id="coordinates"
                  readOnly
                  value={`[${selectedPosition.lng.toFixed(6)}, ${selectedPosition.lat.toFixed(6)}]`}
                  onFocus={(event) => event.target.select()}
                />

                <button onClick={() => setSelectedPosition(null)}>
                  Bỏ chọn
                </button>
              </>
            ) : (
              <p>Chưa chọn vị trí.</p>
            )}
          </section>

          <p className="notice">
            Chưa tích hợp dữ liệu ngập. Bản đồ trống không có nghĩa là khu vực
            không ngập.
          </p>
        </aside>

        <section className="map-section" aria-label="Bản đồ Hà Nội">
          <HanoiMap
            selectedPosition={selectedPosition}
            onSelect={setSelectedPosition}
          />
        </section>
      </main>
    </div>
  );
}
