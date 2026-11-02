# Kết quả áp dụng chiều lưu thông + access 0.1

Dữ liệu: `osm-aaf249200a83d21e`; access `hanoi-access-0.1.0`; chiều `hanoi-direction-0.1.0`.
Đã kiểm tra 15.534 way với 3 phương tiện × 2 hướng = 93.204 quyết định.
Thứ tự toàn bộ tọa độ đối chiếu với chuỗi nút OSM gốc: không có way không khớp trong bộ này.

| Phương tiện | Hướng thuận qua access + chiều | Hướng ngược qua access + chiều |
|---|---:|---:|
| Ô tô con | 8,797 | 7,092 |
| Xe máy | 10,815 | 9,276 |
| Đi bộ | 14,416 | 14,416 |

Các số trên không phải số cạnh graph hoặc số tuyến. Một way có thể xuất hiện ở cả hai cột.
Các kết quả allowed còn chưa xét cấm rẽ, barrier, kích thước, tốc độ và ngập.

## Phát hiện từ dữ liệu nguồn trong vùng phục vụ

- oneway=yes: 1.920 way; oneway=no: 485 way; oneway=-1: 1 way.
- oneway:motorcycle=no: 152 way. Không được áp dụng chiều chung cho xe máy mà bỏ qua ngoại lệ này.
- oneway:foot=no: 11 way. Không kế thừa ngoại lệ xe đạp/moped sang xe máy.
- Một số path/footway có oneway chung được giữ unresolved cho đi bộ vì thiếu ngữ nghĩa rõ.
- Điều kiện về access theo giờ/làn/chiều chưa hỗ trợ vẫn được giữ unresolved, không tự mở quyền.
- Các số chiều thuần trong oneway-modes.csv độc lập với quyền access; không dùng trực tiếp để tạo cạnh được phép.

## File và tái lập

- way-directions.csv: kết quả cho từng way/phương tiện/hướng, nguồn quyết định và lý do.
- direction-summary.csv: trạng thái tổng hợp theo từng phương tiện và hướng.
- oneway-modes.csv: số way theo chiều suy ra trước bước kết hợp access.
- metadata.json: phiên bản và hash đầu vào; hai rules-used.json giữ cấu hình đã dùng.
- BANG_CHIEU_LUU_THONG.md: mô tả toàn bộ quy tắc, chính sách bảo thủ và giới hạn.
- 41 kiểm thử tự động đã đạt (20 access trước đó + 21 chiều).

Bước tiếp theo: xử lý quan hệ cấm rẽ/ngoại lệ trước khi kết hợp xây graph có hướng.
