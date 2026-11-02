# Bảng rào chắn và tốc độ nghiên cứu

Toàn bộ con số tốc độ/kích thước dưới đây là giả định cấu hình, chưa hiệu chỉnh bằng đo đạc. Không phải giới hạn pháp luật. Xem README_BARRIER_SPEED.md để biết cách kết hợp quyền và giới hạn nguồn.

## Tốc độ cơ sở (km/h)

| Loại đường OSM | Ô tô | Xe máy | Đi bộ |
|---|---:|---:|---:|
| primary | 30 | 30 | 4.5 |
| secondary | 25 | 25 | 4.5 |
| tertiary | 22 | 22 | 4.5 |
| unclassified | 18 | 20 | 4.5 |
| residential | 15 | 18 | 4.5 |
| living_street | 10 | 12 | 4 |
| service | 10 | 12 | 4 |
| primary_link | 20 | 20 | 4 |
| secondary_link | 18 | 18 | 4 |
| tertiary_link | 15 | 15 | 4 |
| footway | Chưa gán | Chưa gán | 4.5 |
| pedestrian | Chưa gán | Chưa gán | 4 |
| path | Chưa gán | Chưa gán | 3.5 |
| steps | Chưa gán | Chưa gán | 2 |
| corridor | Chưa gán | Chưa gán | 3.5 |
| cycleway | Chưa gán | Chưa gán | 4 |
| track | Chưa gán | Chưa gán | 3 |

Loại đường không có trong bảng: chưa gán. Tốc độ được tính không mở quyền lưu thông.

## Mẫu kích thước (m)

| Hồ sơ | Rộng | Cao |
|---|---:|---:|
| car | 1.8 | 1.6 |
| motorcycle | 0.8 | 1.5 |
| walking | Chưa gán | Chưa gán |

Các mẫu xe chưa bao gồm mọi dòng xe, người/hàng và biên khoảng hở. Khi tích hợp lựa chọn xe, cần bản cấu hình có phiên bản riêng cho từng mẫu. Chưa gán kích thước đi bộ để tránh suy diễn khả năng lọt khe.

## Trạng thái cổng

allowed_by_model: đáp ứng quy tắc mô hình tại node; forbidden: bị mô hình chặn; restricted: quyền riêng/mục đích chưa cho đi xuyên; unresolved: chưa đủ thông tin. Không có trạng thái nào tự mở quyền của way.
