# Phân nhóm unresolved / invalid — bộ chuyển hướng 0.1

Dữ liệu: osm-aaf249200a83d21e. Báo cáo chuyển hướng: hanoi-turn-0.1.0.
Đã phân tích 2.463 quyết định của 821 quan hệ; có 481 quyết định pending thuộc 347 quan hệ duy nhất.
Phạm vi toàn snapshot (gồm vùng đệm/phụ thuộc), không chỉ vùng phục vụ.

| Nhóm nguyên nhân chính | Ô tô | Xe máy | Hướng xử lý |
|---|---:|---:|---|
| Điều kiện chưa đánh giá | 225 | 55 | Bộ giờ/ngày và thời điểm yêu cầu |
| Qua way/chuỗi via | 100 | 69 | Trạng thái nhớ chuỗi và topology |
| Except sai định dạng/token | 5 | 5 | Đề xuất sửa có đối chiếu |
| Điều kiện nằm trong khóa tĩnh | 1 | 0 | Đề xuất chuyển khóa có đối chiếu |
| Thiếu/thừa/sai thành viên | 16 | 5 | Rà soát nguồn; không đoán nút/đường |

Tổng: ô tô 331 unresolved + 16 invalid = 347 quyết định; xe máy 129 unresolved + 5 invalid = 134.
Đi bộ không có pending trong kết quả trước nên không có dòng trong các nhóm này.
Không cộng 347 + 134 để gọi là số quan hệ; một quan hệ có thể ảnh hưởng hai phương tiện.

## Các vấn đề có thể chồng lên nhau

- Có 16 quyết định ô tô và 4 quyết định xe máy vừa có điều kiện liên quan vừa có via-way.
- Nhóm chính phản ánh lý do bộ xử lý dừng trước; chưa phải tất cả công việc phải làm với quan hệ đó.
- Shape giờ/ngày chỉ là nhận dạng hình thức, chưa kiểm tra hoặc thực thi lịch.
- Sửa định dạng không bảo đảm quan hệ thành ready; nó có thể còn vướng thời gian hoặc topology.

## Ví dụ định dạng cần đối chiếu

| Quan hệ | Phát hiện |
|---|---|
| 9854780 | except dùng dấu phẩy; đồng thời có điều kiện thời gian |
| 17788601 | token motorcyle; đồng thời có điều kiện |
| 19206846 | token motorcyle; đồng thời có điều kiện |
| 20277320 | except chứa cả tiền tố except= |
| 20751856 | except dùng dấu phẩy |
| 20745354 | Biểu thức thời gian nằm trong restriction tĩnh |

Các đề xuất trên chưa được áp dụng, không sửa dữ liệu gốc hoặc OpenStreetMap.
Không có trạng thái nào được tự động chuyển sang ready.

## File cần đọc

- pending-details.csv: ID, phương tiện, nhóm chính, dấu hiệu phụ, tags và URL nguồn.
- groups/*.csv: danh sách riêng để xử lý từng nhóm.
- overlapping-findings.csv: dấu hiệu có thể trùng, không cộng tổng.
- pending-relations.json: 347 quan hệ duy nhất với tags/members và quyết định theo phương tiện.
- metadata.json: hash đầu vào và phạm vi.
- README_TURN_DIAGNOSTICS.md: cách chạy, cách hiểu và thứ tự xử lý.

75 kiểm thử đã đạt (66 trước + 9 chẩn đoán). Chưa tạo graph hoặc định tuyến.
