# Công cụ xem và kiểm tra dữ liệu khảo sát

Đây là phần bổ sung cho `tools/osm-survey` đã có. Không thay web React, API Express,
MongoDB hoặc ORS. Không tạo graph và không diễn giải thuộc tính thành quyền lưu thông.

## Chép file

Giải nén **Hanoi_OSM_Viewer.zip vào thư mục gốc** `E:\hanoi-flood-routing`.
File mới nằm trong `tools/osm-survey`: viewer.py, test_viewer.py, README_VIEWER.md và thư mục viewer/.
Giữ nguyên survey.py và thư mục data/osm-survey đã tải ở bước trước.
Gói bổ sung không chứa dữ liệu OSM tải mới và không ghi đè manual-review.csv.

## Mở công cụ

Mở một PowerShell riêng tại gốc dự án:

```powershell
py -3 tools/osm-survey/viewer.py
```

Chờ đọc dữ liệu và dòng `Mở http://localhost:8765`, rồi mở địa chỉ đó bằng trình duyệt.
Python 3.10+, không cần pip/npm. Lần khởi động đọc GeoJSON và dữ liệu gốc khá lớn nên có thể mất vài giây.
Mặc định chọn thư mục snapshot hoàn tất có tên lớn nhất trong data/osm-survey.
Phiên bản dữ liệu đang mở luôn hiển thị ở đầu trang: hãy kiểm tra đúng snapshot cần xem.

Chọn snapshot cụ thể hoặc cổng khác:

```powershell
py -3 tools/osm-survey/viewer.py --snapshot data/osm-survey/20261028T094314131389Z --port 8765
```

Nếu thư mục phiên bản của bạn có tên khác, thay đúng tên. Cổng bị chiếm thì dừng phiên cũ hoặc đổi `--port 8766`.
Chỉ lắng nghe 127.0.0.1, không mở truy cập qua mạng LAN. Dừng bằng Ctrl+C.

## Chức năng

- Đường màu theo nhóm: chính, khu dân cư/tiếp cận, đi bộ/bậc thang.
- Ranh giới xanh nét đứt: vùng phục vụ; xám nét đứt: vùng tải có đệm.
- Mặc định chỉ hiện đường dạng tuyến; chọn tuyến/vùng/cả hai bằng bộ lọc Hình học.
- Mặc định tắt lớp hạn chế rẽ và rào chắn để bản đồ dễ đọc; bật riêng khi cần.
- Chi tiết tách theo loại: đường, quan hệ rẽ, nút rào chắn; không dùng chung bảng tốc độ/mặt đường cho các đối tượng không phù hợp.
- Lọc vùng phục vụ/vùng tải/tất cả phụ thuộc, loại đường, thiếu maxspeed*, thiếu quyền đi,
  thiếu tên, oneway chung, cầu, bậc thang, điều kiện, đường dạng vùng.
- Tìm tên hoặc mã **way** trong khung bản đồ; không phải dịch vụ tìm địa chỉ.
- Bấm đường xem tags gốc, đường dẫn OSM, các quan hệ rẽ có liên quan.
- Điểm tím: quan hệ hạn chế rẽ. Điểm cam: barrier, bật riêng bằng checkbox.
- Xem from/via/to của quan hệ trên bản đồ. from xanh lam nhạt, to cam, via xanh đậm.
- Via-way có thể dùng một điểm đại diện; giao diện ghi rõ không phải nút rẽ chính xác.
- Mẫu gợi ý tối đa 26 phần tử theo nhóm trong vùng phục vụ; không phải mẫu ngẫu nhiên hoặc dữ liệu đã xác minh.
- Ghi phiếu riêng và xuất CSV/JSON. Không sửa file OSM hoặc tự áp dụng kết quả lên API.

Các nút/tags thiếu không được diễn giải thành được phép/cấm. Dropdown loại đường là số đếm trên bộ GeoJSON
đang đọc, có cả phụ thuộc/area; số hiển thị trên bản đồ là theo bộ lọc và khung nhìn.
Với snapshot gốc, chọn vùng phục vụ, đường dạng tuyến, không bộ lọc khác và nhìn toàn vùng thì tổng là 15.534.
Thêm 73 way dạng vùng thì tổng 15.607. Dòng trạng thái tách số tuyến/vùng sau bộ lọc trong khung; chưa phải cạnh graph.
Các bộ lọc quyền/tốc độ chỉ áp dụng lớp **đường**; điểm rẽ và rào chắn có công tắc riêng.
Lớp đường lấy theo bbox bao hình học của way, không cắt hình học tại khung nhìn.

## Dữ liệu lớn và giới hạn

Đọc file một lần trên server Python, trình duyệt chỉ nhận dữ liệu theo khung nhìn.
Tối đa 3.000 đường/lần; nếu còn nhiều, dòng trạng thái báo rõ, hãy phóng to hoặc lọc thêm.
Danh sách bên trái tối đa 60 đường; vẫn có thể chọn đường khác trực tiếp trên bản đồ.
Mỗi lớp hạn chế rẽ/barrier tối đa 1.000 điểm trong khung; trạng thái hiển thị tổng số.
Màu xanh của đường đang chọn không biểu thị đường an toàn hoặc được phép đi.

Leaflet 1.9.4 được đóng gói cục bộ trong viewer/vendor, xem giấy phép đi kèm.
Chỉ bản đồ nền raster cần mạng đến tile.openstreetmap.org. Có thể tắt bản đồ nền để xem các lớp đường
trên nền trống khi mất mạng. Không tải nền hàng loạt/offline. Giao diện giữ attribution và Referrer phù hợp.
OSM là dữ liệu cần khảo sát; bản đồ nền OSM không phải bằng chứng độc lập xác nhận cùng dữ liệu OSM.

## Phiếu kiểm tra

1. Chọn phần tử trên bản đồ hoặc tab Mẫu gợi ý.
2. Ghi trường hợp kiểm tra, nguồn đối chiếu, thời gian và nhận xét.
3. Chọn `chưa xác định`, `cần bổ sung` hoặc `đúng`.
4. Bấm **Lưu phiếu trên trình duyệt**. Chuyển phần tử khi chưa lưu sẽ không giữ nội dung đang nhập.
5. Bấm **Xuất manual-review.csv** để lấy file có các cột đúng mẫu khảo sát.
6. Bấm **Sao lưu JSON** để có thể khôi phục, hoặc chuyển phiếu sang trình duyệt khác.

Kết luận `đúng` cần URL nguồn đối chiếu. Đây vẫn chỉ là ghi nhận của người rà soát,
không phải kiểm chứng tự động hoặc chứng nhận điều kiện giao thông.
Không có nguồn phù hợp thì giữ `chưa xác định`; chưa cần ra hiện trường.
Thời gian nhập theo thiết bị, xuất ISO có múi giờ UTC. Không tự điền giờ hiện tại thành giờ quan sát.

Phiếu lưu ở localStorage theo phiên bản dữ liệu và origin (địa chỉ/cổng).
`localhost:8765` và `127.0.0.1:8765` là hai origin khác nhau; nên dùng cố định một địa chỉ.
F5 giữ phiếu trên cùng trình duyệt. Nội dung chỉ được giữ sau khi bấm lưu; không có gửi về server.
Không xóa dữ liệu trình duyệt trước khi xuất file. Sao lưu JSON phải cùng phiên bản khi khôi phục;
mục trùng mã được thay bằng mục trong file. CSV chống diễn giải chuỗi ngoài thành công thức Excel.
CSV không tự ghi đè file data/.../manual-review.csv; bạn tự chép file xuất vào snapshot nếu muốn lưu cùng bộ khảo sát.

## Kiểm thử trên máy bạn

```powershell
py -3 -m unittest discover -s tools/osm-survey -p "test_*.py" -v
```

Mong đợi **26 kiểm thử đạt** (13 khảo sát + 13 viewer). Không gọi mạng.
Kiểm thử này không đánh giá giao diện đồ họa hoặc tính đúng thực địa.
Đã thử API với snapshot thật và mở chi tiết 26 mẫu gợi ý. Luồng nhập/lưu/khôi phục phiếu
đã thử bằng DOM giả lập với Leaflet được mô phỏng. Chưa kiểm tra kết xuất bản đồ trong trình duyệt đồ họa đầy đủ ở môi trường đóng gói.

Kiểm tra thủ công giao diện:

1. Mở trang, xác nhận phiên bản dữ liệu; thấy ranh giới và đường.
2. Phóng to: số đường và lớp bản đồ thay đổi, không mất đường đang chọn.
3. Chọn `Thiếu maxspeed*`: bấm đường, xem tags không có maxspeed*.
4. Vào Mẫu gợi ý, chọn hạn chế rẽ: xem tags và thành viên from/via/to.
5. Lưu một phiếu `chưa xác định`; F5 rồi mở tab Phiếu đã lưu.
6. Xuất CSV và kiểm tra tiếng Việt/các cột trong Excel.
7. Sao lưu JSON; khôi phục cùng file phải giữ số phiếu, không tạo bản trùng.
8. Thu nhỏ cửa sổ: bản đồ nằm trên, bộ lọc và phiếu ở dưới.

## Git

Commit các file mới trong tools/osm-survey. Không thêm ZIP hoặc node_modules thử nghiệm.
Giữ nguyên quy tắc bỏ qua data/osm-survey và data/osm-survey-test đã thêm trước đó.
Trước khi commit, kiểm tra `git diff --cached --stat` để chắc không có dữ liệu lớn.

## Sửa lỗi kết nối Windows

Server xử lý kết nối bị ngắt trong lúc gửi header/body (gồm WinError 10053), không cố gửi thêm HTTP 500 trên cùng socket. Favicon trả 204. Hai kiểm thử hồi quy mới kiểm tra ngắt kết nối và phản hồi lỗi trên socket đã ngắt.
