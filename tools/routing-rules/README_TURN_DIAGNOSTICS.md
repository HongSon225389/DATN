# Phân nhóm unresolved/invalid — chuyển hướng 0.1

Giải nén vào gốc `E:\hanoi-flood-routing`, đã có tools/routing-rules từ ba bước trước.
Gói chỉ thêm chương trình chẩn đoán và báo cáo, không sửa OSM, phiếu, các quy tắc hoặc trạng thái đã chuẩn hóa.
Chưa tạo graph, chưa chạy Dijkstra và chưa tự đưa quy tắc pending vào định tuyến.

## Chạy kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

Mong đợi 75 kiểm thử (66 trước + 9 chẩn đoán). Python 3.10+, không cần pip/npm, không gọi mạng.

## Chạy trên kết quả của bạn

```powershell
py -3 tools/routing-rules/turn_diagnostics.py --snapshot data/osm-survey/20261028T094314131389Z --turn-result data/routing-turn/20261028T165353584329Z --output data/routing-turn-diagnostics
```

Đường dẫn --turn-result phải là thư mục **kết quả chuyển hướng** bạn vừa chạy, không phải file dữ liệu OSM.
Nếu tên thư mục khác thì thay đúng tên. Snapshot và báo cáo phải cùng phiên bản/hash.
Mỗi lần tạo thư mục mới. Giữ bộ cũ để so sánh.

## File đầu ra

| File                     | Nội dung                                                                |
| ------------------------ | ----------------------------------------------------------------------- |
| group-summary.csv        | Nhóm nguyên nhân chính theo phương tiện và trạng thái                   |
| pending-details.csv      | Từng quyết định chưa xử lý, có ID, tags liên quan, lý do và hướng xử lý |
| groups/\*.csv            | Danh sách riêng của từng nhóm, cùng cột với pending-details             |
| overlapping-findings.csv | Các dấu hiệu phụ có thể trùng nhau                                      |
| pending-relations.json   | Quan hệ duy nhất, tags/members gốc và quyết định từng phương tiện       |
| metadata.json            | Hash, phiên bản, số quyết định và số quan hệ duy nhất                   |

**Nhóm chính cộng được, dấu hiệu phụ không cộng được.** Ví dụ quan hệ vừa theo giờ vừa qua via-way
có nhóm chính conditional_time, đồng thời có dấu hiệu phụ via_way_single/multiple.
Không được cộng các dấu hiệu phụ rồi gọi là tổng số lỗi hoặc tổng số quan hệ.

Đơn vị thống kê: (relation_id, profile), không phải cạnh graph hoặc số biển báo ngoài đường.
481 quyết định pending có thể chỉ thuộc 347 quan hệ vì một quan hệ ảnh hưởng nhiều phương tiện.

## Ý nghĩa nhóm

| Mã                      | Ý nghĩa                                 | Hướng xử lý                                                               |
| ----------------------- | --------------------------------------- | ------------------------------------------------------------------------- |
| conditional_time        | Quy tắc có điều kiện chưa đánh giá      | Xây bộ giờ/ngày, múi giờ và thời điểm yêu cầu; kiểm thử trước khi áp dụng |
| via_way                 | Qua một hoặc nhiều way                  | Kiểm tra chuỗi kết nối, giữ trạng thái nhớ chuỗi cạnh                     |
| exception_format        | Except sai dấu phân cách/token lạ       | Đối chiếu nguồn, đề xuất bản sửa cục bộ có người rà soát                  |
| inline_condition        | Điều kiện được đặt trong trường tĩnh    | Đối chiếu rồi đề xuất tách sang khóa conditional                          |
| member_shape            | Thiếu/thừa/sai vai trò from/via/to      | Rà soát bản nguồn; không đoán đường/nút còn thiếu                         |
| missing_member          | Thiếu đối tượng được tham chiếu         | Kiểm tra tải đủ trước khi kết luận dữ liệu gốc sai                        |
| disconnected            | Thành viên không nối được               | Kiểm tra topology, không tự nối                                           |
| ambiguous_topology      | Nhiều hướng vào/ra không phân biệt được | Giữ đoạn nguồn, phân tích hướng vào/ra khi tạo graph                      |
| only_conflict           | Nhiều only\_\* mâu thuẫn                | Rà soát cùng hướng vào; không tự hợp nhất hoặc chọn một                   |
| mode_exception_conflict | Ngoại lệ mâu thuẫn quy tắc riêng        | Rà soát trước khi định ưu tiên                                            |
| unsupported_value       | Ngữ nghĩa chưa hỗ trợ                   | Bổ sung xử lý đúng loại hoặc giới hạn phạm vi                             |
| other                   | Nguyên nhân chưa ánh xạ                 | Đọc dữ liệu và phiên bản bộ phân loại                                     |

P1/P2/P3 là **thứ tự nghiên cứu/triển khai**, không phải điểm tin cậy hoặc mức nguy hiểm:

- P1: định dạng có thể đối chiếu rõ và bộ điều kiện thời gian (có tác động lớn trong mẫu).
- P2: via-way, topology phức tạp và loại quan hệ mới.
- P3: dữ liệu thiếu/mâu thuẫn cần căn cứ riêng; không được bỏ qua chỉ vì xếp P3.

`conditional_shape` chỉ nhận dạng hình thức chuỗi giờ/ngày, chưa đánh giá tính đúng cú pháp đầy đủ,
ngày lễ, múi giờ hay điều kiện đang có hiệu lực. daily_time_shape_not_evaluated không có nghĩa đã hỗ trợ quy tắc đó.

## Những phát hiện cần đối chiếu

Trong snapshot đã phân tích có:

- Dấu phẩy thay dấu chấm phẩy trong except.
- Token `motorcyle` có thể là lỗi gõ của motorcycle.
- Giá trị except chứa thêm chuỗi `except=`.
- Biểu thức `@ (...)` nằm trong restriction thay vì restriction:conditional.
- Quan hệ thiếu from, to hoặc via, hoặc có số lượng thành viên vượt mô hình đang hỗ trợ.

Không tự sửa những giá trị trên. Sửa token có thể làm thay đổi phương tiện được miễn hạn chế,
nên cần lưu đề xuất, nguồn đối chiếu và quyết định rà soát riêng. Không ghi ngược lên OpenStreetMap.

## Giới hạn và việc tiếp theo

Chẩn đoán hiện hỗ trợ báo cáo chuẩn hóa hanoi-turn-0.1.0; phiên bản khác bị từ chối để tránh ánh xạ sai lý do.
Tags/members được đối chiếu file gốc; giữ hash của báo cáo đầu vào để tái lập.
Các trạng thái pending vẫn nguyên vẹn. Không tăng số ready và không tạo đường đi mới.

Thứ tự tiếp theo đề xuất:

1. Lập danh sách đề xuất sửa định dạng, có rà soát, tách khỏi nguồn gốc.
2. Hỗ trợ biểu thức giờ/ngày thường gặp, không suy từ giờ đăng bài hoặc giờ tải dữ liệu.
3. Hỗ trợ via-way với trạng thái nhớ chuỗi, kiểm tra kết nối và chiều.
4. Quyết định chính sách với quan hệ thiếu/mâu thuẫn trước khi tích hợp graph.

Không bỏ qua các nhóm pending rồi tuyên bố tuyến tuân thủ đầy đủ.

## Git

Thêm `/data/routing-turn-diagnostics/` vào .gitignore.
Commit mã/test/hướng dẫn mới, không ZIP hoặc dữ liệu lớn theo mặc định.
Mã dùng giấy phép MIT của tools/routing-rules/LICENSE đã có; dữ liệu giữ giấy phép OSM.
