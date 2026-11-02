# Chặn đúng hai cạnh từ phiếu HIST-03

Giải nén ZIP vào gốc E:\hanoi-flood-routing, ghi đè. Yêu cầu các gói trước, đặc biệt Historical Spatial Review, Edge Attachment Fix và Flood Routing Prototype. Không dựng lại graph. Phiếu docs/routing/spatial-reviews/review-HIST-03-car.json giữ nguyên, không tự approved hoặc sửa applied_to_routing.

## Kịch bản tách biệt

edge_closure_scenario.py đọc phiếu thật trên máy bạn, kiểm tra graph/dataset/hash, nguồn tham chiếu, ngày sự kiện, hình học và ID. Phải đúng hai cạnh forward/backward của cùng một đoạn, đầu mút đảo nhau. Không tự thêm chiều, không tự tìm đoạn khác theo tên hoặc tạo polygon bao các ngõ. Tệp riêng có data_mode=synthetic. Chặn chính xác ID đã chọn, không chặn các đoạn/ngõ khác chỉ vì ở gần.

Giới hạn theo profile của phiếu: phiếu car chỉ chặn mạng ô tô, không tự áp lên xe máy/đi bộ. Có thể lập kịch bản riêng cho các phương tiện khác khi có phiếu đúng graph/profile. Graph lưu trên đĩa và phiếu nguồn không đổi. Kịch bản chỉ có hiệu lực trong lần chạy nạp --edge-scenario và khi bật checkbox so sánh; bỏ tham số/checkbox để trở về tuyến thường. Không nạp cùng --flood trong lần chạy này.

Nguồn tin ngập 2025 vẫn là tham chiếu; phạm vi ngõ 54–77 là lựa chọn nghiên cứu, chưa xác minh trùng phạm vi địa chỉ 49–93. Thời điểm đánh giá graph 2026 chỉ là giờ của mô hình thử nghiệm, không phải giờ quan sát ngập hay nước rút. Không có ngưỡng độ sâu hoặc xác nhận an toàn đi qua.

## 1. Tạo kịch bản từ phiếu đã lưu

```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
py -3 tools/routing-rules/edge_closure_scenario.py `
  --graph "$($newGraph.FullName)" `
  --review docs/routing/spatial-reviews/review-HIST-03-car.json `
  --output data/routing-scenarios/hist03-two-edges.json `
  --compare-output data/routing-edge-closure-tests
```

Lệnh in chính xác hai ID bị chặn. Phải kiểm tra chúng đúng lựa chọn. Nếu output đã tồn tại, chọn tên output mới để giữ mốc trước. Nếu phiếu không đúng hai chiều cùng đoạn, lệnh báo lỗi thay vì đoán. Không chỉnh JSON danh sách cạnh bằng tay chỉ để test qua.

Cặp điểm thử tự lấy giữa đoạn liền trước/sau đoạn bị chặn. Không dùng hai đầu nằm ngay trong phần đóng. Kết quả baseline/avoided lưu trong thư mục có timestamp tại data/routing-edge-closure-tests, gồm comparison.json và GeoJSON của tuyến nào tìm được. CLI dùng diagnostic khi graph thiếu coverage, ghi rõ trong kết quả; không coi đó là tuyến được xác minh ngoài thực tế.

## 2. Mở trên bản đồ

Dừng viewer cũ Ctrl+C rồi chạy:

```powershell
py -3 tools/routing-rules/graph_viewer.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z `
  --edge-scenario data/routing-scenarios/hist03-two-edges.json
```

Vào http://localhost:8766, Ctrl+F5. Chọn ô tô, có thể tắt Node bị chặn đi xuyên để dễ nhìn. Đoạn đỏ đậm là cạnh đóng của kịch bản; chấm đỏ nhỏ vẫn là node kiểm soát graph, không phải tin ngập. Giữ/chủ động bật diagnostic vì graph ô tô còn thiếu coverage.

Bấm Nạp cặp điểm thử tránh ngập; khi có --edge-scenario, nút này lấy cặp điểm từ kịch bản mới, không dùng cặp Nguyễn Trãi → Giải Phóng. Checkbox so sánh được chọn; bấm Tính tuyến Dijkstra. Tuyến thường xám đứt được giữ để so sánh cả khi không có tuyến tránh. Bỏ checkbox và tính lại để chỉ xem baseline.

## Đọc kết quả

- found: có đường trên graph sau khi loại đúng hai cạnh; vẫn cần xem cảnh báo coverage.
- no_route: không có kết nối/tuyến theo graph hiện tại; không tự bỏ cấm rẽ, mở rào chắn hoặc bắc nối qua đoạn bị chặn để tạo đường vòng. Không chứng minh thực địa chắc chắn không có lối khác.
- endpoint_blocked_by_flood: vị trí yêu cầu nối vào giữa cạnh đóng. Đổi điểm ra ngoài đoạn đóng; thuật toán không tự snap sang đường xa hơn.
- coverage_incomplete: chế độ strict bị khóa theo chính sách cũ; có thể chủ động bật diagnostic để thử.

Nguồn hai cạnh 335384251:5:forward/backward theo ảnh: kiểm tra local có baseline khoảng 100.06m, nhưng sau đóng đoạn, cặp điểm ngay hai bên rơi vào hai WCC khác nhau của graph đã lọc và trả no_route. Đây là kết quả hợp lệ để lưu trong báo cáo, không phải tuyến tránh luôn phải tìm được. Các đường phụ quanh đó có thể không có quyền/kết nối trong mô hình; không tự mở chúng.

## Xác minh local

331 tests đạt; Python compile và JS syntax đạt. Có kiểm thử chặn đúng hai ID, bất biến graph/phiếu, không lan sang profile khác, từ chối phiếu một cạnh/graph cũ/hình học sai, tìm đường vòng trên fixture có kết nối và không tự đổi điểm nằm trong đoạn đóng. Đã replay tuyến thực từ cặp local qua đầy đủ máy quy tắc rẽ và kiểm tra cạnh nguồn; kết quả no_route do khác cụm được giữ nguyên. Chưa có kiểm thử tự động trình duyệt đồ họa hoặc chạy Windows trực tiếp.

validation/two-edge-scenario/comparison.json là phép kiểm tra local dùng hai ID trong ảnh, không phải tệp phiếu mà người dùng xuất và không xác nhận ranh ngập. Gói không cấp sẵn kịch bản đóng đường để tránh bỏ qua phiếu thực trên máy; phải chạy bước 1.

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```
