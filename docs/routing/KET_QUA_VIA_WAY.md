# Kết quả chuẩn hóa via-way

Snapshot osm-aaf249200a83d21e: toàn bộ 821 restriction relations, gồm vùng đệm/phụ thuộc; 2.463 quyết định cho ba phương tiện tại mỗi thời điểm.

| Phương tiện | Trạng thái | 29/10/2026 08:00 +07 | 12:00 +07 |
|---|---|---:|---:|
| Ô tô | ready tổng | 646 | 553 |
| Ô tô | trong đó ready via-way | 115 | 101 |
| Ô tô | inactive_at_time | 36 | 129 |
| Ô tô | unresolved | 48 | 48 |
| Ô tô | invalid | 17 | 17 |
| Ô tô | exempt | 58 | 58 |
| Ô tô | not_applicable | 16 | 16 |
| Xe máy | ready tổng | 181 | 178 |
| Xe máy | trong đó ready via-way | 72 | 69 |
| Xe máy | inactive_at_time | 27 | 30 |
| Xe máy | unresolved | 30 | 30 |
| Xe máy | invalid | 5 | 5 |
| Xe máy | exempt | 560 | 560 |
| Xe máy | not_applicable | 18 | 18 |
| Đi bộ | not_applicable | 821 | 821 |

Dòng 'trong đó' là tập con ready, không cộng thêm vào tổng. Đây là thời điểm giả định để thử lịch; không phải quan sát hiện trường. ready chỉ chuẩn hóa, chưa gắn graph. Đi bộ không có restriction:foot không đồng nghĩa mọi giao lộ đều hợp lệ.

So với mô-đun giờ/ngày lúc 08:00, unresolved ô tô giảm 163 → 48, xe máy 102 → 30. Không chỉnh dữ liệu nguồn để đạt các số này. Những lịch ngoài cú pháp hỗ trợ, ngoại lệ sai và topology mơ hồ vẫn chưa xử lý.
