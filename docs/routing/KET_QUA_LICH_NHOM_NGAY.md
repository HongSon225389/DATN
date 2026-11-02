# Kết quả mở rộng lịch nhóm ngày

Snapshot osm-aaf249200a83d21e; so sánh cùng scope study và thời điểm 29/10/2026 08:00 +07.

Graph cũ: graph-9916f381388c66a5. Graph mới trong môi trường kiểm tra: graph-1c2c79d222809c13. Phiên bản trên máy khác có thể khác nếu byte mã nguồn khác.

| Hồ sơ | Pending local mới | Unlocated cũ → mới | Coverage mới | Node/cạnh so với cũ |
|---|---:|---|---|---|
| car | 14 | 17 → 16 | False | Bằng nhau |
| motorcycle | 6 | 5 → 4 | False | Bằng nhau |
| walking | 0 | 0 → 0 | True | Bằng nhau |

Có 60 quyết định hồ sơ/relation thay đổi (35 ô tô, 25 xe máy). Các mục này từ unresolved sang inactive_at_time tại thời điểm thử; chưa được coi là mất hiệu lực vĩnh viễn. Không thay nguồn để đạt các số này.

Relation 16733522 đủ cấu trúc, lịch được đánh giá đúng ở ngoài/ở trong khung. Đã kiểm tra trực tiếp raw OSM: thứ Năm 08:00 inactive_at_time; thứ Sáu 20:00 và thứ Bảy 06:00 ready, bộ kiểm tra chuỗi trả forbidden ở segment cuối. Không tự mở đường hoặc xóa restriction.

Node/cạnh/kích thước WCC/SCC không đổi, nhưng kiểm tra chuyển hướng có thay đổi. Coverage ô tô/xe máy vẫn thiếu do các quan hệ nguồn còn chưa định vị. Chưa triển khai định tuyến hoặc ngập.

232 tests đạt; gồm 12 test lịch mới (có toàn bộ 10.080 phút một tuần của mẫu), 2 test so sánh graph và 218 test trước.
