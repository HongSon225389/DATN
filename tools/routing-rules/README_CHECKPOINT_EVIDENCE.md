# Lưu mốc kiểm thử ngay và tiếp nhận dữ liệu thật

Giải nén ZIP vào gốc E:\hanoi-flood-routing. Cần đã cài các gói routing trước, đặc biệt Flood Routing Prototype. Không cần dựng lại graph.

## Vì sao lưu ngay?

Bộ test hiện tại chứng minh các hành vi đã lập trình, là mốc phát hiện hồi quy. Nó không chứng minh dữ liệu OSM hay ngập là đúng ngoài thực tế. Khi có nguồn thật, bổ sung bộ kiểm thử riêng; không bỏ hay ghi đè bộ giả lập. Các lần thất bại cũng cần log để biết lý do.

save_routing_checkpoint.py lưu vào thư mục mới có timestamp UTC:
- routing-source.zip: các file mã nguồn/config/test/README cấp đầu và thư mục graph-viewer, có SHA-256 trong checkpoint.json; không thu thập .env hay toàn bộ dự án.
- metadata graph và policy, metadata snapshot nếu có. Không nhân đôi toàn bộ graph hoặc raw OSM, do đó vẫn phải giữ thư mục dữ liệu gốc để tái chạy.
- unit-tests.log và mã thoát.
- kết quả regression 9 ca cùng log.
- ca CLI ngập giả lập ô tô, GeoJSON tuyến thường/tránh và comparison.json cùng log.
- checkpoint.json kết luận các bước PASS/FAIL, phiên bản Python và dấu vết nguồn.

Nếu bộ ca pin không khớp graph đang dùng, regression sẽ lỗi và checkpoint vẫn giữ log; không tự sửa kỳ vọng để test qua. Source archive tự chứa công cụ checkpoint. Log con được ép UTF-8 để đọc tiếng Việt trên Windows. Chưa thử trực tiếp Windows, đã chạy trọn luồng trên Python/Linux.

Chạy tại gốc repo:

```powershell
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
py -3 tools/routing-rules/save_routing_checkpoint.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z `
  --output data/routing-checkpoints
```

Không cần chờ dữ liệu thật mới chạy lệnh này. Mỗi lần chốt một thay đổi đáng kể hoặc thay dữ liệu, tạo mốc mới. Không nhất thiết chạy mỗi lần sửa chữ giao diện. Hai ảnh so sánh do bạn chụp cũng nên giữ cùng ghi chú checkpoint nếu dùng trong luận văn; script không tự lấy ảnh màn hình.

## Hồ sơ nguồn đã chuẩn bị

historical-evidence/intake-20250930.json và SURVEY_NOTES.md chứa 5 trường hợp ngập lịch sử từ nguồn công khai đã đọc, các ID way chỉ là gợi ý tên đường, các thiếu hụt và lý do chưa áp dụng định tuyến. Chưa có polygon được xác minh, chưa có khoảng hiệu lực chắc chắn; không nạp intake như tệp --flood. Không sửa hay xuất bản dữ liệu MongoDB.

Ưu tiên tiếp: xác định vị trí cổng trường trên Nguyễn Khuyến và khoảng địa chỉ trên Bùi Xương Trạch bằng nguồn bản đồ công khai; rà phạm vi ngập và lưu bằng chứng. Không tự biến toàn bộ phố thành vùng ngập. Chi tiết nguồn, khác biệt năm sự kiện 2025 với snapshot 2026 và quy trình chuyển sang kiểm thử có nguồn nằm trong SURVEY_NOTES.md.
