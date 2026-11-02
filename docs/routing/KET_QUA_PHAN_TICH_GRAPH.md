# Kết quả phân tích graph và bản đồ kiểm tra

Graph graph-9916f381388c66a5, snapshot osm-aaf249200a83d21e. Không dựng lại hoặc sửa graph.

## Cụm WCC lớn nhất trong mạng khoảng cách

| Hồ sơ | Cụm 1 | Cụm 2 | Cụm 3 | Tỷ lệ node thuộc cụm 1 |
|---|---:|---:|---:|---:|
| car | 22441 | 95 | 94 | 75.58% |
| motorcycle | 32998 | 94 | 86 | 91.50% |
| walking | 45586 | 313 | 215 | 90.09% |

Cụm này chỉ dựa trên topology trước trạng thái lịch sử rẽ; không chứng minh mọi cặp điểm tìm được tuyến tuân thủ đủ hạn chế. Node bao gồm terminal port. Mạng thời gian và SCC có phân nhóm riêng trong components.csv.

## Quan hệ làm thiếu coverage

| Hồ sơ | Có incoming guard (chặn chuyển tiếp cục bộ) | Chưa định vị hướng vào |
|---|---:|---:|
| car | 48 | 17 |
| motorcycle | 30 | 5 |
| walking | 0 | 0 |

Đếm theo quyết định hồ sơ, không cộng thành số quan hệ OSM duy nhất. Các relation đã có URL, members/tags gốc và bbox gợi ý. Bbox của phần thành viên còn lại không khôi phục from/to/via bị thiếu và không chứng minh phạm vi ảnh hưởng. Không thay đổi coverage.

ID chưa định vị theo hồ sơ:

- car: 9859076, 9887803, 9890814, 11149314, 16261490, 16261491, 16733522, 16748507, 16748508, 17096522, 17646494, 17646495, 17646496, 17896280, 21042852, 21042854, 21716103
- motorcycle: 9890814, 16733522, 17096522, 21042852, 21042854

## Đã triển khai

- Xuất toàn bộ cụm, thành viên node, kích thước, cạnh nội bộ/cạnh biên và bounds.
- Xuất pending theo hồ sơ, trạng thái và khả năng định vị.
- Viewer localhost:8766 có lọc phương tiện, khoảng cách/thời gian, WCC/SCC/cụm; node bị chặn và chi tiết cạnh.
- Xác thực hash graph và snapshot, chỉ đọc, không nới quyền hoặc sửa phiếu.
- 204 tests đạt. Kiểm tra HTTP tĩnh/API trên graph thật và cú pháp JavaScript; chưa kiểm thử ảnh trình duyệt tự động.

Bước tiếp theo là xem cụm lớn, mẫu cụm nhỏ và các relation thiếu hướng vào. Chưa tự động quy kết nguyên nhân từng cụm, chưa Dijkstra/snap/API định tuyến/ngập.
