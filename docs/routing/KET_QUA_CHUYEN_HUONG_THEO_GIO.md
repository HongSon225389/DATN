# Kết quả đánh giá chuyển hướng theo thời gian

Snapshot osm-aaf249200a83d21e, toàn bộ 821 quan hệ gồm vùng đệm/phụ thuộc; mỗi thời điểm 2.463 quyết định cho ba phương tiện. Không phải số cạnh graph hoặc chỉ số trong vùng phục vụ.

| Phương tiện | Trạng thái | Thứ Năm 29/10/2026 08:00 +07 | 12:00 +07 |
|---|---|---:|---:|
| Ô tô | ready | 531 | 452 |
| Ô tô | inactive_at_time | 36 | 115 |
| Ô tô | unresolved | 163 | 163 |
| Ô tô | invalid | 17 | 17 |
| Ô tô | exempt | 58 | 58 |
| Ô tô | not_applicable | 16 | 16 |
| Xe máy | ready | 109 | 109 |
| Xe máy | inactive_at_time | 27 | 27 |
| Xe máy | unresolved | 102 | 102 |
| Xe máy | invalid | 5 | 5 |
| Xe máy | exempt | 560 | 560 |
| Xe máy | not_applicable | 18 | 18 |
| Đi bộ | not_applicable | 821 | 821 |

ready là có mẫu chuyển tiếp chuẩn hóa tại thời điểm chỉ định, chưa áp dụng graph. inactive_at_time là quan hệ không có hạn chế hiệu lực tại thời điểm đó, không có nghĩa được phép đi qua hoặc đường an toàn. Số lượng invalid ô tô tăng từ 16 lên 17 vì sau khi diễn giải điều kiện, chương trình kiểm tra sâu hơn cấu trúc thành viên; không phải sửa hoặc làm hỏng nguồn.

Đi bộ không kế thừa restriction chung dành cho xe; không có restriction:foot trong snapshot không chứng minh mọi giao lộ đều đi bộ được.

Các kết quả này là đánh giá dữ liệu đường OSM tại thời điểm giả định để kiểm thử, không phải quan sát giao thông/ngập thực tế ngày 29/10.

Tập cú pháp hỗ trợ còn hạn chế (xem README_TURN_TIME.md). Không tự sửa lịch dùng dấu ; hoặc token sai. Không được bỏ qua unresolved/invalid khi tạo bộ định tuyến hoàn chỉnh.
