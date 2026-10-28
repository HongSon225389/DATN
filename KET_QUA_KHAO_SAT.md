# Kết quả khảo sát dữ liệu OSM thật — 28/10/2026

Nguồn: © OpenStreetMap contributors, ODbL 1.0. Thu thập qua Overpass API.
Hoàn tất lúc khoảng 16:44 giờ Việt Nam. Snapshot nguồn OSM: 16:42 cùng ngày.
Phiên bản dữ liệu: `osm-aaf249200a83d21e`.
Phạm vi phục vụ: [105.800, 20.990, 105.850, 21.040] (tây, nam, đông, bắc).
Vùng tải: khung có đệm xấp xỉ 2 km; xem hai file ranh giới để biết phạm vi chính xác đã dùng.

## Bảng khảo sát vùng phục vụ

Đơn vị là OSM way, chưa phải cạnh định tuyến. Một đường phố có thể có nhiều way.
Mẫu số 15.534 way dạng tuyến, đủ hình học, giao vùng phục vụ; chưa lọc quyền lưu thông.
Giữ các loại construction/proposed để khảo sát; chúng chưa được phép tự động trở thành đường đi.

| Chỉ tiêu | Số lượng | Tỷ lệ |
|---|---:|---:|
| Đường nguồn dạng tuyến giao vùng phục vụ | 15,534 | — |
| Có tên | 6,296 | 40.53% |
| Có thuộc tính oneway | 2,406 | 15.489% |
| Có ít nhất một thuộc tính quyền đi | 3,518 | 22.647% |
| Có thuộc tính motorcar | 1,681 | 10.821% |
| Có thuộc tính motorcycle | 1,344 | 8.652% |
| Có thuộc tính foot | 599 | 3.856% |
| Có maxspeed | 1,871 | 12.045% |
| Có ít nhất một thuộc tính maxspeed* | 1,904 | 12.257% |

Trong toàn vùng tải có 40.292 way dạng tuyến giao khung tải (gồm cả vùng phục vụ).
Tổng phản hồi có 182.663 phần tử OSM duy nhất và 821 quan hệ hạn chế rẽ.
821 quan hệ thuộc phạm vi phản hồi/vùng tải và phụ thuộc, **không phải số quan hệ riêng trong vùng phục vụ**.
Trong đó 686 quan hệ có cấu trúc đơn giản from-way/via-node/to-way; 135 cấu trúc phức tạp hơn.
Tất cả thành viên quan hệ có mặt trong file; chưa quan hệ nào được thực thi bởi bộ máy định tuyến.
Không phát hiện way thiếu tọa độ/nút trong phản hồi. Điều này không chứng minh mạng đường ngoài thực địa đầy đủ.

## Kết luận sử dụng

- Đã có dữ liệu hình học để bắt đầu dựng đồ thị thí điểm.
- maxspeed chỉ có trên 12,045% way trong mẫu; cần mô hình tốc độ dự phòng và ghi rõ giả định.
- Thuộc tính quyền đi riêng còn thiếu. Không suy ra cấm hoặc cho phép chỉ từ việc tag vắng mặt.
- 8.375 way service, 3.520 footway và 282 steps: phải phân loại trước khi dùng cho ô tô/xe máy/đi bộ.
- Có điều kiện theo giờ và cấu trúc hạn chế rẽ phức tạp; phải giữ và công bố mức hỗ trợ.
- survey-issues.csv có 93.314 dòng trên toàn phạm vi xử lý. Phần lớn là thiếu tên, maxspeed hoặc quyền đi; đây là mục cần xem xét, không phải 93.314 lỗi đường.
- Chưa kiểm tra thủ công 20–30 vị trí, chưa kiểm chứng biển báo/quyền đi/tốc độ ngoài thực tế.
- Chưa dựng đồ thị, tính thành phần liên thông, triển khai Dijkstra hoặc sửa API/web.

## Chạy lại

Giải nén vào thư mục gốc dự án; mã ở tools/osm-survey, dữ liệu ở data/osm-survey.
Đọc tools/osm-survey/README.md để tải mới hoặc khảo sát lại file JSON ngoại tuyến.
Các bài kiểm thử dùng fixture nhân tạo riêng, không trộn vào dữ liệu tải thật.
Bộ mã đã qua 13 bài kiểm thử ngoại tuyến.

## Nguồn và tái lập

- https://www.openstreetmap.org/copyright
- https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
- Giữ metadata.json, query.overpassql và osm-raw.json cùng nhau.
- SHA-256 dữ liệu gốc: `aaf249200a83d21ec9074219ee0c3694179c82fdad0f1db16c5656bd93b91634`.
