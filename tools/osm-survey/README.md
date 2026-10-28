# Khảo sát dữ liệu đường OSM — Hanoi Flood Routing

Phiên bản 1.0.0. Công cụ độc lập, Python **3.10 trở lên**, không cần pip hoặc API key.
Không kết nối MongoDB, không sửa server/client, không chạy Dijkstra và chưa tạo đồ thị định tuyến.

## Cài vào dự án Windows

Giải nén, chép cả thư mục này thành:

```
E:\hanoi-flood-routing\tools\osm-survey\
    survey.py
    test_survey.py
    README.md
    .gitignore
    examples\synthetic-fixture.json
```

Mở PowerShell tại `E:\hanoi-flood-routing`:

```powershell
py -3 --version
py -3 tools/osm-survey/survey.py --output data/osm-survey
```

Nếu máy dùng lệnh `python` thay cho `py`, thay `py -3` bằng `python`.
Mỗi lần chạy tạo thư mục riêng theo giờ UTC trong `data/osm-survey` và in đường dẫn kết quả.
Không ghi đè snapshot cũ. Ngày giờ thu thập không phải ngày ngập hay ngày kiểm chứng thực địa.

Vùng phục vụ mặc định: tây 105.800, nam 20.990, đông 105.850, bắc 21.040.
Vùng tải mở rộng một **khung chữ nhật xấp xỉ 2 km mỗi phía**. Đây không phải buffer hình học
chính xác và không phải ranh giới hành chính. Hai GeoJSON lưu ranh giới thực sự đã dùng.

Đổi phạm vi (thứ tự **kinh độ tây, vĩ độ nam, kinh độ đông, vĩ độ bắc**):

```powershell
py -3 tools/osm-survey/survey.py --bbox 105.800 20.990 105.850 21.040 --buffer-km 2 --output data/osm-survey
```

Timeout mặc định: máy chủ 90 giây, kết nối đọc 105 giây. Không gửi yêu cầu lặp liên tục.
Chỉ tự gọi một endpoint một lần cho mỗi lần chạy. Khi gặp lỗi, đọc thông báo, thử lại sau hoặc dùng cách tải thủ công.

## Khi Overpass lỗi hoặc bị chặn

1. Chuẩn bị query, không gọi mạng:

```powershell
py -3 tools/osm-survey/survey.py --prepare-only --output data/osm-survey
```

2. Mở thư mục vừa in. Sao chép **toàn bộ** `query.overpassql` vào https://overpass-turbo.eu/.
3. Bấm Run. Chờ hoàn tất. Xuất **raw data / dữ liệu thô**, định dạng **Overpass JSON**,
   lưu thành `osm-raw.json`. Không chọn GeoJSON, XML hoặc chỉ lấy tâm đường.
4. Khảo sát file đã tải, dùng **cùng bbox và buffer** với query:

```powershell
py -3 tools/osm-survey/survey.py --input "C:\Users\YOUR_NAME\Downloads\osm-raw.json" --output data/osm-survey
```

Chương trình không tự xác minh được query/phạm vi của một file ngoại tuyến bất kỳ. Vì vậy metadata
ghi `input_coverage_verified: false`. Giữ query đã chạy cùng file gốc để đối chiếu.

Có thể chỉ định endpoint Overpass HTTPS khác bằng `--endpoint`, nhưng cần kiểm tra đơn vị vận hành
và chính sách sử dụng trước. Không hạ xuống HTTP, không tắt kiểm tra SSL.

## File đầu ra và cách đọc

| File | Nội dung |
|---|---|
| study-area.geojson | Ranh giới phục vụ |
| download-area.geojson | Khung tải có đệm xấp xỉ |
| query.overpassql | Query chính xác đã chuẩn bị |
| osm-raw.json | Bytes JSON gốc, không sửa |
| roads.geojson | LineString đầy đủ của các way có đủ tọa độ; giữ nguyên tags |
| roads.csv | Từng đường nguồn: phạm vi, chiều dài, các thuộc tính cần khảo sát |
| restrictions.json | Quan hệ rẽ với from/via/to, tags, ngoại lệ và điều kiện nguyên bản |
| barriers.geojson | Các nút có barrier và thuộc tính |
| survey-summary.csv | Bảng số lượng, mẫu số, tỷ lệ |
| survey-issues.csv | Thiếu thuộc tính, thiếu hình học, tốc độ chưa đọc được, điều kiện chưa xử lý… |
| manual-review.csv | Mẫu trống để ghi kết quả kiểm tra thực địa/nguồn đối chiếu |
| metadata.json | Trạng thái, thời gian, nguồn, bbox, hash, phiên bản, cảnh báo |

CSV mã hóa UTF-8 BOM để mở tiếng Việt trong Excel. Nếu Excel không tách cột,
dùng Data → From Text/CSV, chọn UTF-8 và dấu phẩy. Không tự sửa dấu phẩy bên trong trường dữ liệu.
Chuỗi bắt đầu bằng ký tự công thức được thêm dấu nháy đơn trong CSV để Excel không chạy công thức
từ nội dung bên ngoài. JSON/GeoJSON giữ nguyên giá trị gốc.

Mẫu số là **số OSM way dạng tuyến có đủ hình học giao vùng đang xét**, chưa phải cạnh đồ thị,
không phải số đường phố và không phải tổng km đường. Một way rất dài vẫn chỉ tính một lần.

Các scope:

- `raw`: toàn bộ dữ liệu trả về, gồm các phần tử phụ thuộc của quan hệ.
- `study_intersection`: đường giao vùng phục vụ; có thể chỉ giao một phần.
- `download_intersection`: đường giao khung tải, gồm vùng phục vụ và vùng đệm.
- Trong roads.csv: `dependency_outside` là đường ngoài khung tải được bổ sung để giữ đầy đủ quan hệ.
- `unknown_geometry`: thiếu hình học, không tự đưa vào mẫu số theo vùng; vẫn được báo cáo rõ.

Không cắt hình học ở ranh giới. `length_m` là chiều dài **toàn way** tính bằng khoảng cách cầu,
không phải chiều dài chỉ nằm trong khung. Không cộng cột này để kết luận tổng chiều dài trong vùng.
Đường area=yes được giữ để kiểm tra nhưng loại khỏi mẫu số đường tuyến.

Ví dụ: `tag:maxspeed=40/200 → 20%` nghĩa là 40 trong 200 đường nguồn có tag đó.
Không có nghĩa 80% còn lại không giới hạn tốc độ. Tương tự thiếu `motorcycle` không đồng nghĩa cấm xe máy.

`maxspeed_scalar` chỉ đọc số đơn, đơn vị mặc định km/h, có hỗ trợ mph.
`signals`, `walk`, `VN:...`, danh sách, theo làn, theo giờ… giữ nguyên và đánh dấu cần xử lý.
Không suy ra giới hạn pháp luật. Thông tin chiều, quyền đi và cấm rẽ chỉ được **khảo sát**, chưa diễn giải thành quy tắc chạy xe.
`simple_via_node_shape=true` chỉ xác nhận cấu trúc quan hệ, không có nghĩa hạn chế đã được áp dụng.

Query lấy các highway way có nút nằm trong bbox; lấy thêm quan hệ restriction chứa các way đó và
đệ quy tất cả thành viên. Một đoạn rất dài cắt ngang bbox mà không có nút trong bbox có thể bị bỏ sót bởi nguồn truy vấn.
Không coi kết quả là kiểm kê toàn bộ đường ngoài thực địa. Không lọc chỉ thành phần liên thông lớn nhất.

Phản hồi HTTP 200 có `remark` lỗi của Overpass bị từ chối, không tạo bảng thành công từ dữ liệu có thể thiếu.
Lỗi tải ghi `status=failed` và trả exit code 1. Chạy thành công nghĩa là xử lý xong file, không chứng nhận dữ liệu chính xác/đầy đủ.

## Kiểm tra thủ công sau khi tải thật

Chọn 20–30 trường hợp đa dạng từ roads.csv và survey-issues.csv: đường một chiều, ngõ,
lối đi bộ, cầu/hầm, barrier, cấm rẽ. Ghi vào manual-review.csv các cột:
`osm_type, osm_id, test_case, evidence_url, observed_at, conclusion, note`.
Kết luận: đúng / cần bổ sung / chưa xác định. Chưa tự chọn mẫu hoặc tạo bằng chứng.
Nguồn đối chiếu và mốc thời gian phải rõ; ảnh bản đồ chỉ giúp kiểm tra hình học, không xác nhận biển báo.

## Kiểm thử ngoại tuyến

```powershell
py -3 -m unittest discover -s tools/osm-survey -p "test_*.py" -v
py -3 tools/osm-survey/survey.py --input tools/osm-survey/examples/synthetic-fixture.json --output data/osm-survey-test
```

**synthetic-fixture.json là dữ liệu kiểm thử nhân tạo**, không phải bản tải Hà Nội.
Mọi số trong kết quả chạy fixture chỉ phục vụ kiểm tra xử lý, không được đưa vào báo cáo khảo sát thực tế.
Kiểm thử không gọi mạng và không sửa DB/web.

## Git và tái lập

Commit mã công cụ, README và fixture. Thêm `/data/osm-survey/` và `/data/osm-survey-test/`
vào .gitignore của dự án nếu dùng các thư mục đầu ra như trên.
Snapshot dữ liệu nên lưu riêng có phiên bản; giữ metadata, query và hash cùng dữ liệu gốc.
Không chỉnh trực tiếp tags gốc để sửa lỗi: lưu phần bổ sung thủ công riêng với nguồn và người rà soát.

## Nguồn dữ liệu và tài liệu

Mã công cụ: MIT (xem LICENSE). Dữ liệu OSM: © OpenStreetMap contributors,
ODbL 1.0; giấy phép mã không thay thế giấy phép dữ liệu.

- https://www.openstreetmap.org/copyright
- https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
- https://osmnx.readthedocs.io/en/stable/user-reference.html

Sau khảo sát mới quyết định bộ lọc quyền đi và bảng quy tắc, rồi xây dựng đồ thị có hướng.
Không thể kết luận tuyến an toàn hoặc hợp pháp chỉ từ bảng độ đầy đủ tags này.
