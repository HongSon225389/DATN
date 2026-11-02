# Kết quả dựng graph Hà Nội v0.1

Snapshot osm-aaf249200a83d21e; graph_version graph-9916f381388c66a5. Thời điểm đóng băng 29/10/2026 08:00 +07; scope study.

- 15.534 way dạng tuyến giao vùng khảo sát.
- 54.296 ID node nguồn trên các way được chọn, trước khi lọc quyền.
- Không cắt way tại biên bbox; không nối đường theo tọa độ gần nhau.

| Hồ sơ | Node graph | Cạnh khoảng cách | Cạnh thời gian | WCC | SCC |
|---|---:|---:|---:|---:|---:|
| car | 29690 | 54512 | 54346 | 1157 | 2136 |
| motorcycle | 36063 | 72036 | 71964 | 417 | 1101 |
| walking | 50602 | 113958 | 113958 | 510 | 510 |

Node graph bao gồm terminal port tại node cổng/quyền/kích thước bị chặn. WCC/SCC là topology segment trước kiểm tra trạng thái lịch sử rẽ; không phải khả năng tìm tuyến đầy đủ. Node chỉ có trên cạnh khoảng cách có thể không xuất hiện trong mạng thời gian.

| Hồ sơ | Đầu mút ảo | Hạn chế rẽ pending chưa định vị | Barrier dạng shape chưa hỗ trợ | Đủ coverage theo chính sách |
|---|---:|---:|---:|---|
| car | 850 | 17 | 0 | False |
| motorcycle | 921 | 5 | 0 | False |
| walking | 1129 | 0 | 0 | True |

Ô tô có 17 và xe máy có 5 quan hệ unresolved/invalid chưa định vị hướng vào; hàm GraphTransitions strict sẽ từ chối mở rộng, không giả vờ kiểm tra đầy đủ. Đi bộ đủ coverage trong tập hạn chế được mô hình hóa, không chứng minh dữ liệu thực tế hoặc quy định địa phương đã đầy đủ. Chưa hồ sơ nào có router triển khai.

Graph vẫn xuất thành công để kiểm tra cấu trúc và phục vụ chẩn đoán. Không tự bỏ các quan hệ lỗi hoặc mở cổng để nối mạng. Bộ định tuyến tương lai cần chính sách khoanh vùng lỗi được chứng minh hoặc công bố rõ chế độ thử nghiệm chưa đủ coverage.

190 tests đạt: 165 cũ + 25 kiểm thử graph. Có kiểm tra một chiều/ngoại lệ xe máy, quyền/kích thước, node access không có barrier, cổng tách port, cạnh song song, node trùng tọa độ không gộp, restriction/via-way/lịch sử, pending coverage, chi phí khoảng cách/thời gian, WCC/SCC, hash và tái lập graph.

Bước tiếp theo: phân tích các cụm liên thông và các quan hệ chưa định vị, chọn vùng thử; sau đó triển khai nối điểm đi–đến và Dijkstra giữ lịch sử. Chưa áp dụng ngập.
