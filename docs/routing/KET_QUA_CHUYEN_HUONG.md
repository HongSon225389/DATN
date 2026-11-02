# Kết quả chuẩn hóa chuyển hướng 0.1

Dữ liệu: osm-aaf249200a83d21e. Quy tắc: hanoi-turn-0.1.0.
821 quan hệ trong toàn bộ snapshot, gồm vùng đệm/phụ thuộc; 2.463 quyết định theo phương tiện.
Chưa tạo graph, chưa áp dụng các quy tắc này vào API hoặc ORS.

| Trạng thái | Ô tô | Xe máy | Đi bộ |
|---|---:|---:|---:|
| Đã chuẩn hóa tĩnh | 400 | 109 | 0 |
| Được miễn theo except | 58 | 560 | 0 |
| Không có quy tắc áp dụng | 16 | 18 | 821 |
| Chưa xử lý đầy đủ | 331 | 129 | 0 |
| Lỗi thành viên/topology | 16 | 5 | 0 |

ready chỉ nghĩa là chuẩn hóa được mẫu from/via/to; chưa chứng minh chuyển tiếp đi được hoặc phù hợp ngoài thực tế.
Đi bộ not_applicable=821 do bộ này không có restriction:foot; không có nghĩa mọi giao lộ đều được đi bộ qua.

## Hai ví dụ đã rà soát trên viewer

- Quan hệ 9774377, car: ready — Đã chuẩn hóa quy tắc tĩnh qua một via node; chưa gắn vào graph
- Quan hệ 9774377, motorcycle: ready — Đã chuẩn hóa quy tắc tĩnh qua một via node; chưa gắn vào graph
- Quan hệ 9774377, walking: not_applicable — Không có restriction áp dụng cho phương tiện; đi bộ không kế thừa restriction chung của xe
- Quan hệ 9843239, car: exempt — Phương tiện nằm trong except, không áp dụng hạn chế chung này
- Quan hệ 9843239, motorcycle: exempt — Phương tiện nằm trong except, không áp dụng hạn chế chung này
- Quan hệ 9843239, walking: not_applicable — Không có restriction áp dụng cho phương tiện; đi bộ không kế thừa restriction chung của xe

## Giới hạn quan trọng

- Điều kiện theo giờ và via-way vẫn chờ xử lý. Không được bỏ qua chúng khi công bố tuyến tuân thủ quy tắc.
- Via-node tĩnh được ánh xạ vào đoạn nguồn có chỉ số đoạn và chiều. Không chỉ dùng wayId để tránh chặn nhầm đi thẳng khi cấm quay đầu.
- Các only_* mâu thuẫn cho cùng hướng vào được đánh dấu unresolved.
- File normalized giữ tags, thành viên, ngoại lệ, lý do và dấu applied_to_graph=false.
- Chưa đánh giá khả năng tiếp cận các đoạn theo access/chiều, barrier, kích thước, tốc độ hay ngập.
- Có 66 kiểm thử đã đạt: 20 access + 21 chiều + 25 chuyển hướng.
- Bước tiếp theo cần xác định chính sách với các quan hệ chưa hỗ trợ trước khi tích hợp graph.
