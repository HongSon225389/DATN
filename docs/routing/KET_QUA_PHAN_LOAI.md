# Kết quả phân loại quyền way — cấu hình nghiên cứu 0.1

Bộ dữ liệu: osm-aaf249200a83d21e. Quy tắc: hanoi-access-0.1.0.
Phạm vi: 15.534 OSM way dạng tuyến giao vùng phục vụ. Mỗi way có ba quyết định, tổng 46.602.
Đây là kết quả áp dụng tag và giả định, KHÔNG phải số đoạn được phép đi đã xác minh ngoài thực tế.

| Trạng thái | Ô tô con | Xe máy | Đi bộ |
|---|---:|---:|---:|
| Qua bước quyền way | 8,798 | 10,816 | 14,424 |
| Bị loại theo tag/mặc định | 5,005 | 3,614 | 129 |
| Quyền/mục đích hạn chế | 1,240 | 627 | 682 |
| Chưa xử lý được/chưa rõ | 112 | 98 | 245 |
| Ngoài phạm vi mô hình | 379 | 379 | 54 |

## Cách sử dụng

- Đọc BANG_QUYEN_DI.md trước. Mỗi quyết định có source_key/source_value/reason/warning trong way-access.csv.
- Xem access-rule-sources.csv để phân biệt quyết định từ thuộc tính cụ thể và bảng mặc định.
- allowed chỉ qua bước access: chiều, cấm rẽ, cổng/rào, kích thước, tốc độ và ngập còn phải xét.
- destination/private được giữ restricted, chưa hỗ trợ tiếp cận đặc biệt tới điểm đầu/cuối.
- Điều kiện theo giờ/chiều/làn của access liên quan được giữ unresolved, chưa bỏ qua để cho đi.
- Cao tốc motorway/motorway_link tạm loại cả ba cấu hình do phạm vi bản đầu, không phải tuyên bố cấm ô tô theo luật.
- Đi bộ có thể được mặc định trên đường chung; không khẳng định vỉa hè/sang đường an toàn.
- Hai phiếu rà soát trước đó không được tự động áp dụng làm dữ liệu ghi đè.
- Chưa tạo graph, chưa sửa viewer hoặc ORS.
- Bộ quy tắc có 20 kiểm thử, bao gồm kế thừa, ngoại lệ, điều kiện chưa xử lý và xuất báo cáo không sửa nguồn.

## Việc tiếp theo

Rà soát các giả định trong bảng. Sau đó xử lý chiều/chuyển hướng rồi mới xây graph và kiểm tra kết nối.
Không dùng tỷ lệ allowed làm chỉ số độ chính xác pháp lý.
