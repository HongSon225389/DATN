# Quyền đi đa phương tiện — bước trước khi tạo graph

Giải nén vào gốc dự án `E:\hanoi-flood-routing`. Thư mục mới:
`tools/routing-rules`. Không ghi đè công cụ khảo sát, dữ liệu OSM hoặc phiếu đã lưu.

Đọc **BANG_QUYEN_DI.md trước**: đây là quy tắc nghiên cứu 0.1, chưa phải kết luận pháp lý.
Chỉ xử lý way-access; chưa tạo graph, xét chiều, cấm rẽ, barrier, kích thước, tốc độ hoặc ngập.

## Chạy kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

## Phân loại dữ liệu đã tải

```powershell
py -3 tools/routing-rules/access_rules.py --snapshot data/osm-survey/20261028T094314131389Z --output data/routing-access
```

Thay tên snapshot nếu dùng bộ khác. Python 3.10+, không cần thư viện bổ sung, không gọi mạng.
Kết quả tạo thư mục thời gian UTC mới; không ghi đè kết quả cũ.

Mỗi way có ba quyết định, tương ứng car/motorcycle/walking. Mặc định chỉ lấy way tuyến
giao vùng phục vụ, không area=yes, nên snapshot gốc có mẫu số 15.534 way và 46.602 quyết định.
`allowed` chỉ có nghĩa qua bước quyền way, không phải được phép đi theo mọi hướng hoặc có thể đi qua cổng.
`restricted` được giữ riêng, không tự biến destination/private thành cấm tuyệt đối.

## Git

Commit tools/routing-rules và bảng quy tắc. Thêm `/data/routing-access/` vào .gitignore.
Giữ báo cáo đã tải kèm như một snapshot thí nghiệm, không đọc kết quả của nó thành xác nhận thực địa.

Mã có giấy phép MIT (xem LICENSE). Tài liệu OSM và dữ liệu tải giữ giấy phép riêng của nguồn.
