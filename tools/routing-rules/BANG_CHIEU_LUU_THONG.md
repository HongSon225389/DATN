# Chiều lưu thông + quyền way — cấu hình nghiên cứu 0.1

Phiên bản chiều: `hanoi-direction-0.1.0`, kết hợp quyền đi `hanoi-access-0.1.0`.
Đây là mô hình diễn giải dữ liệu OSM phục vụ đồ án, chưa xác minh quy định ngoài thực tế.
Không tạo graph, chưa áp dụng cấm rẽ, barrier, kích thước, tốc độ hoặc ngập.

## 1. Thuận và ngược là gì?

Way gốc có thứ tự nút `[n1, n2, ..., nk]`:

- `forward`: đi theo thứ tự đó.
- `backward`: đi theo thứ tự đảo lại.

Không có nghĩa thuận là hướng Bắc/Đông, bên phải hay chiều tăng số nhà.
Với way khép kín, nút đầu có thể trùng nút cuối nhưng thứ tự các nút bên trong vẫn quan trọng.
Chương trình đối chiếu **toàn bộ** chuỗi tọa độ GeoJSON với chuỗi nút OSM gốc.
Không khớp thì không cho trạng thái allowed; không tự đảo hoặc sửa nguồn.

## 2. Giá trị oneway

| Giá trị áp dụng          | Thuận   | Ngược   | Xử lý                                      |
| ------------------------ | ------- | ------- | ------------------------------------------ |
| yes                      | Có thể  | Không   | Một chiều theo way                         |
| -1                       | Không   | Có thể  | Một chiều ngược thứ tự way                 |
| no                       | Có thể  | Có thể  | Có xác nhận hai chiều trong tag            |
| 1 / true                 | Như yes | Như yes | Chấp nhận dạng tương đương trong bộ xử lý  |
| 0 / false                | Như no  | Như no  | Chấp nhận dạng tương đương trong bộ xử lý  |
| reversible / alternating | Chưa rõ | Chưa rõ | Chưa có mô hình chiều động                 |
| Giá trị không hỗ trợ     | Chưa rõ | Chưa rõ | Không coi là hai chiều                     |
| Thiếu tag áp dụng        | Có thể  | Có thể  | Giả định mặc định, có ghi nguồn quyết định |

“Có thể” chỉ nói qua bước chiều; vẫn phải có quyền đi tương ứng.
Thiếu tag khác với `oneway=no`: báo cáo phân biệt source_key của hai trường hợp.

## 3. Ngoại lệ theo phương tiện

Ưu tiên từ cụ thể đến tổng quát:

| Phương tiện | Chuỗi khóa chiều                                                   |
| ----------- | ------------------------------------------------------------------ |
| Ô tô        | oneway:motorcar → oneway:motor_vehicle → oneway:vehicle → oneway   |
| Xe máy      | oneway:motorcycle → oneway:motor_vehicle → oneway:vehicle → oneway |
| Đi bộ       | oneway:foot; oneway chung chỉ xét theo loại đường ở phần 4         |

Ví dụ `oneway=yes` cùng `oneway:motorcycle=no`: ô tô chỉ thuận, xe máy có thể cả hai chiều,
nếu access cho phép. Không kế thừa ngoại lệ bicycle/moped/mofa sang motorcycle.
Các khóa tổng quát theo nhóm là quy tắc của bộ xử lý; dữ liệu thí điểm hiện không có
oneway:motor_vehicle/oneway:vehicle nên phần này được kiểm bằng ca thử nhân tạo.

`oneway:motorcycle=no` không mở đường `motorcycle=no`.

## 4. Đi bộ

| Tình huống                                                       | Chính sách                                       |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| Có oneway:foot                                                   | Xét trực tiếp giá trị riêng                      |
| Đường phố thông thường có oneway chung                           | Không tự áp dụng chiều xe cho đi bộ              |
| steps có oneway chung                                            | Áp dụng cho đi bộ                                |
| footway/path/corridor có oneway chung hạn chế, thiếu oneway:foot | unresolved vì có thể mơ hồ                       |
| footway/path có oneway=no                                        | Hai chiều theo mô hình nếu quyền đi cho phép     |
| Không có tag chiều phù hợp                                       | Giả định hai chiều, chưa phải kiểm chứng thực tế |

Không suy ra lối đi bộ được phép chỉ từ việc chiều không bị cấm.
Đi bộ vẫn phải qua bảng access; chưa giải quyết chỗ sang đường, vỉa hè hoặc tiếp cận xe lăn.

## 5. Chiều ngầm định

- Xe cơ giới: `junction=roundabout` thiếu tag chiều → thuận theo way.
- `junction=circular` không được tự coi giống roundabout.
- `oneway=no` cụ thể ghi đè chiều ngầm định của vòng xuyến.
- `highway=motorway` có chiều thuận ngầm định ở bộ diễn giải, nhưng bảng quyền 0.1 vẫn
  loại motorway khỏi phạm vi. Vì vậy không có allowed trên cao tốc chỉ do quy tắc này.
- Người đi bộ không kế thừa chiều vòng xuyến của xe.

## 6. Quyền đi theo chiều

Hỗ trợ giá trị tĩnh `motorcar:forward`, `motorcar:backward`, tương tự cho motorcycle,
motor_vehicle, vehicle, access và foot theo chuỗi kế thừa của phương tiện.

Ở mỗi hướng:

1. Xét khóa phương tiện cụ thể nhất.
2. Trong cùng khóa, giá trị `:forward` hoặc `:backward` ưu tiên hơn giá trị chung của khóa đó.
3. Nếu không có khóa phù hợp thì dùng bảng mặc định quyền đi hiện có.
4. Kết hợp quyền đó với ràng buộc oneway.

Ví dụ:

- `motorcar:backward=no`: ô tô không đi ngược, hướng thuận xét các thuộc tính còn lại.
- `access=no + motorcar:forward=yes`: có thể mở riêng chiều thuận cho ô tô.
- `motorcar=no + access:forward=yes`: không mở cho ô tô, vì motorcar cụ thể hơn access.
- `oneway=yes + motorcar:backward=yes`: bản bảo thủ vẫn chặn ngược; access=yes riêng lẻ
  không đủ hủy oneway. Muốn thể hiện ngoại lệ chiều cần tag oneway phù hợp hoặc rà soát mâu thuẫn.

Quy tắc cuối là lựa chọn bảo thủ của phiên bản, cần đưa dữ liệu mâu thuẫn vào mẫu kiểm tra.
Không sửa access_rules.py 0.1: mô-đun mới chỉ tách các hậu tố chiều tĩnh đã hỗ trợ
trước khi gọi lại bộ phân loại access cho từng chiều.

## 7. Điều kiện chưa xử lý

- oneway:conditional hoặc khóa chiều có điều kiện liên quan → unresolved, không bỏ qua để dùng tag tĩnh.
- access có điều kiện/làn vẫn giữ unresolved theo bộ access cũ.
- Quyền chỉ một hướng có điều kiện có thể làm cả hai hướng unresolved trong bản bảo thủ;
  chưa tuyên bố tối ưu hóa phạm vi ảnh hưởng của từng điều kiện.
- Điều kiện psv/bus/bicycle không tự áp dụng cấu hình car/motorcycle/walking.
- Đi bộ trên đường phố không chịu oneway chung cũng không chịu oneway:conditional chung của xe.
- Điều kiện oneway chung trên path/footway được giữ unresolved kể cả có tag riêng: bản này chọn bảo thủ,
  chưa diễn giải đầy đủ ưu tiên giữa mọi điều kiện và ngoại lệ.

Không có tham số giờ khởi hành ở giai đoạn này. Chưa đánh giá hiện tại là giờ nào để mở/đóng đường.

## 8. Kết hợp kết quả

Lưu riêng `access_state` và `direction_state`, rồi tạo trạng thái tổng hợp:

| Điều kiện                         | Trạng thái tổng hợp |
| --------------------------------- | ------------------- |
| Access ngoài phạm vi              | excluded            |
| Access cấm hoặc chiều cấm         | forbidden           |
| Một bước chưa rõ                  | unresolved          |
| Access hạn chế, chiều cho phép    | restricted          |
| Access cho phép và chiều cho phép | allowed             |

Khi thứ tự nút không được đối chiếu: giữ access đã excluded/forbidden; các trường hợp còn lại unresolved.
Chỉ `allowed` đặt `eligible_after_access_direction=true`.
Đây chưa phải eligible toàn tuyến: cấm rẽ, barrier, kích thước và ngập còn chưa xét.

## 9. File kết quả

- `way-directions.csv`: mỗi way có 3 phương tiện × 2 hướng = 6 quyết định.
- `direction-summary.csv`: thống kê từng phương tiện, từng hướng và trạng thái; mẫu số mỗi nhóm là số way.
- `oneway-modes.csv`: số way theo hướng oneway suy ra; độc lập với quyền đi.
- `metadata.json`: phiên bản, hash, thời gian, số way, số quyết định, số way không khớp thứ tự nút.
- Hai file `*-rules-used.json`: cấu hình thực tế đã dùng.

Số quyết định hoặc lượt hướng allowed **không phải số cạnh graph**.
Một way sau này có thể bị chia thành nhiều đoạn tại giao lộ hoặc vị trí thay đổi thuộc tính.

## 10. Căn cứ kỹ thuật

- https://wiki.openstreetmap.org/wiki/Key:oneway
- https://wiki.openstreetmap.org/wiki/Key:oneway:motorcycle
- https://wiki.openstreetmap.org/wiki/Key:oneway:foot
- https://wiki.openstreetmap.org/wiki/Forward_%26_backward,_left_%26_right

Ngữ nghĩa OSM được kết hợp với chính sách bảo thủ của đồ án. Không thay cho đối chiếu quy định địa phương
và không xác nhận dữ liệu phản ánh đúng biển báo hiện hành.
