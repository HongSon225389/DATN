# Rà soát vị trí ngập lịch sử trên graph — 29/10/2026

Giải nén ZIP vào E:\hanoi-flood-routing, ghi đè các tệp tools/routing-rules. Cần các bản sửa graph/tải trọng/nối điểm và Flood Routing Prototype đã cài. Không dựng lại graph. Bộ nguồn 5 hồ sơ được kèm để không phụ thuộc việc đã giải nén gói checkpoint hay chưa.

## Chức năng

- Phần Rà soát ngập lịch sử trên sidebar: danh sách hồ sơ, liên kết bài nguồn, mô tả và các thiếu hụt.
- Đường vàng là các cạnh gợi ý theo tên, độc lập giới hạn 2000 cạnh của viewport nền; API riêng giới hạn 1500 cạnh và báo rõ tổng/truncation. Gợi ý chỉ lấy từ graph phương tiện hiện tại, không phải tất cả dữ liệu OSM. Các đường đã bị loại trước khi dựng graph không hiện trong tập này.
- Bật chọn cạnh rồi bấm cạnh vàng hoặc cạnh graph nền để thêm/bỏ. Các cạnh chọn tô tím đậm, danh sách ghi ID, chiều, bridge/layer và liên kết OSM. Bấm Bỏ để xóa. Nếu đoạn có hai chiều trong graph, dùng Thêm chiều còn lại để chọn thêm; không tự giả định nguồn xác nhận ngập cả hai chiều. Một cạnh có hướng là một lựa chọn. UI tối đa 300 cạnh mỗi phiếu.
- Nút đánh dấu mốc: bấm một vị trí trên bản đồ, ghi nguồn https dùng để xác định mốc. Mốc không tạo vùng hay bán kính ngập. Có trường riêng cho nguồn chứng minh phạm vi ngập, người rà soát và nhận xét.
- Tự lưu nháp trong localStorage theo graph/event/profile. Đổi hồ sơ hoặc phương tiện tải lại bản nháp tương ứng; graph khác không tự tái sử dụng lựa chọn cũ. Khi không lưu được, UI báo và yêu cầu xuất JSON.
- Xuất/khôi phục JSON. Khôi phục kiểm tra graph/dataset/hash, event, profile, hình học và ID từng cạnh qua API; không chấp nhận cạnh lạ hay hình học tự sửa. Không giữ lại trạng thái nhập một phần nếu một cạnh kiểm tra lỗi. Giới hạn tệp nhập 3MB. Bản nháp có thể giữ URL đang gõ dở ở localStorage; phải sửa thành https hợp lệ trước xuất.
- Tất cả phiếu xuất đều review_status=draft, applied_to_routing=false, valid_from/valid_until=null. Đây là danh sách cạnh đề xuất để đối chiếu, không phải polygon đã xác minh hoặc tệp --flood.
- Server chỉ đọc: không có POST lưu hồ sơ, không ghi MongoDB/OSM/graph, không thay route/coverage. JSON tải xuống theo vị trí tải mặc định của trình duyệt; localStorage không thay thế bản sao lâu dài.

## Mở viewer

Dừng viewer cũ Ctrl+C. Tại gốc repo:

```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
py -3 tools/routing-rules/graph_viewer.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z `
  --evidence tools/routing-rules/historical-evidence/intake-20250930.json
```

Mở http://localhost:8766, Ctrl+F5. Không cần --flood khi đang rà soát nguồn thật để tránh nhầm với kịch bản ngập giả lập. Có thể nạp thêm --flood như trước nếu cần; hai lớp vẫn độc lập, việc chọn cạnh không ảnh hưởng nó.

## Thử với HIST-02 — Nguyễn Khuyến

1. Chọn phương tiện. Có thể tắt Node bị chặn đi xuyên cho dễ nhìn; những chấm đỏ đó không phải điểm ngập.
2. Kéo sidebar xuống Rà soát ngập lịch sử, chọn HIST-02. Bản đồ đưa về các đường gợi ý, không đưa về cổng trường đã được định vị sẵn.
3. Mở bài nguồn. Tìm mốc trường bằng nguồn bản đồ công khai và đối chiếu. Bấm Đánh dấu vị trí mốc trên bản đồ rồi bấm mốc; ghi URL nguồn định vị. Chưa định vị được thì để trống, không đoán.
4. Bật chọn cạnh. Chọn các đoạn đề xuất để rà, xem đúng hướng/phần đường/cầu/hầm. Việc có mốc trường không chứng minh toàn bộ cạnh chọn bị ngập; ghi rõ phần chưa đủ căn cứ trong nhận xét.
5. Điền người rà soát, nguồn xác nhận phạm vi nếu có và nhận xét. Nếu chỉ có bài báo nhắc địa danh, ghi phạm vi chưa xác nhận.
6. Xuất phiếu nháp JSON. Trình duyệt thường lưu trong Downloads. Giữ file cùng ghi chú/bằng chứng, có thể chuyển vào docs/routing/spatial-reviews.
7. Khôi phục từ JSON để tiếp tục trên đúng graph/profile/event; không nạp file này vào --flood.

HIST-03 — Bùi Xương Trạch làm tương tự, phải xác định đúng khoảng số nhà và phần đường chịu ảnh hưởng. Không chọn toàn bộ way chỉ vì cùng tên.

## Kiểm tra file đã xuất bằng CLI

```powershell
$reviewFile = Join-Path $env:USERPROFILE 'Downloads/review-HIST-02-car.json'
py -3 tools/routing-rules/historical_review.py `
  --graph "$($newGraph.FullName)" `
  --evidence tools/routing-rules/historical-evidence/intake-20250930.json `
  --review "$reviewFile"
```

PASS chỉ xác nhận cấu trúc, nguồn tham chiếu, graph, ID và hình học. Không xác nhận cạnh bị ngập, thời gian hiệu lực hay quyền đi ngoài thực địa. Nếu trình duyệt đổi tên tệp tải xuống, dùng đúng tên thực tế trong --review.

## Xác minh và giới hạn

323 test đạt: tra cứu catalog/cạnh, giới hạn/truncation, graph cũ không khớp, định danh/hình học sai, cạnh trùng, nguồn https, mốc tọa độ, ngăn phiếu approved/applied, bất biến graph và API chỉ đọc. Python compile, JS syntax đạt; chưa kiểm thử tự động trên trình duyệt đồ họa hay trực tiếp Windows.

Đã chạy lookup 5 hồ sơ × 3 phương tiện trên graph-032aff9c6fde9d9e. HIST-02 có 17 cạnh ô tô gợi ý thuộc các way tên Nguyễn Khuyến. Các cạnh này CHƯA được xác nhận thuộc phạm vi ngập. Đã kiểm tra một lựa chọn tổng hợp bằng CLI chỉ nhằm kiểm tra cấu trúc, không tạo bản đồ ngập thật. validation/historical-review/summary.json ghi kết quả kỹ thuật.

Nguồn ngập năm 2025 và snapshot đường năm 2026: luôn giữ khác biệt này trong phiếu, không đổi ngày sự kiện sang hiện tại. Gợi ý tên đường có thể gồm ngõ/đường phụ hoặc đoạn xa vị trí tin; phải đối chiếu thủ công bằng nguồn công khai. Không mở rộng ranh giới khi chưa có chứng cứ. Hiện chưa có công cụ vẽ polygon, chưa chuyển phiếu nháp thành quyết định đóng đường và chưa xử lý thời gian hiệu lực thật.
