# Kết quả rào chắn và tốc độ

Snapshot osm-aaf249200a83d21e, thời điểm đánh giá 29/10/2026 08:00 +07. Đây là thử quy tắc, không phải quan sát thực địa.

- 1.912 node barrier toàn snapshot, gồm vùng đệm/phụ thuộc.
- 721 node barrier nằm trên các way khảo sát theo ID node.
- 15.534 way dạng tuyến giao vùng khảo sát; 93.204 quyết định tốc độ (ba hồ sơ × hai chiều) và 46.602 quyết định kích thước.

## Rào chắn nằm trên way khảo sát

| Phương tiện | allowed_by_model | forbidden | restricted | unresolved |
|---|---:|---:|---:|---:|
| car | 2 | 144 | 69 | 506 |
| motorcycle | 2 | 130 | 69 | 520 |
| walking | 17 | 102 | 70 | 532 |

Thiếu thông tin cổng nên phần unresolved cao; không tự coi cổng đang mở. allowed_by_model bao gồm giả định thao tác mở cổng không khóa/cọc chắn đi bộ, không xác minh quyền hoặc khoảng hở ngoài thực tế.

## Tốc độ theo chiều way

| Hồ sơ | Có tốc độ ước tính | Chưa đủ tốc độ ước tính | Tổng |
|---|---:|---:|---:|
| car | 22.960 | 8.108 | 31.068 |
| motorcycle | 22.960 | 8.108 | 31.068 |
| walking | 30.860 | 208 | 31.068 |

Ở snapshot này, các dòng speed unresolved do chưa gán ước tính cho loại đường/hồ sơ, không phải 8.108 tag OSM sai. Các số đếm gồm cả chiều bị cấm và way chưa đủ quyền đi.

Giới hạn số đọc được: car 3.766 dòng chiều, motorcycle 3.742 dòng; còn lại thiếu tag áp dụng. Không có maxspeed:foot, nên giới hạn walking đều missing. Mô hình không biến các giá trị tốc độ mặc định thành giới hạn luật giao thông đã xác minh.

## Kích thước trên way

| Hồ sơ | Bị giới hạn chặn | Không bị giới hạn đã biết chặn | Chưa rõ |
|---|---:|---:|---:|
| car | 146 | 15.283 | 105 |
| motorcycle | 6 | 15.423 | 105 |
| walking | 0 | 15.074 | 460 |

Nhóm không bị giới hạn đã biết chặn phần lớn có thể thiếu tag; không đồng nghĩa đã xác nhận đủ rộng/cao.

150 tests đạt, gồm 32 test mới. Chưa tạo graph, chưa tổng hợp quyền tuyến, chưa áp dụng ngập.
