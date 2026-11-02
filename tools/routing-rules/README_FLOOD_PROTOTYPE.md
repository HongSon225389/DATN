# Bộ ca cố định và lớp tránh ngập thử nghiệm — 29/10/2026

Giải nén ZIP vào E:\hanoi-flood-routing, ghi đè. Yêu cầu đã cài Mass Restrictions Fix và Edge Attachment Fix. Không cần dựng lại graph. Các thay đổi thuộc tools/routing-rules; chưa nối với ứng dụng React/Express hay dữ liệu MongoDB.

## Đã triển khai

1. routing_regression.py chạy 3 cặp điểm × 3 phương tiện = 9 ca cố định. routing-regression-cases.json lưu kỳ vọng state và chiều dài với sai số 1m, pin graph-032aff9c6fde9d9e, dataset osm-aaf249200a83d21e, thời điểm 08:00 +07 ngày 29/10/2026. Không tự ghi đè kỳ vọng; không khớp graph/dataset/thời điểm thì dừng để đánh giá lại. Các kỳ vọng là kết quả mô hình, không phải chứng cứ pháp lý/thực địa. Car/motorcycle diagnostic, walking strict.
2. flood_overlay.py ánh xạ Polygon vào các cạnh có hướng. Cắt/giao/tiếp xúc biên đều chặn TOÀN BỘ đoạn cạnh raw, không chỉ phần nằm trong polygon. Nhiều vùng ngập cùng ảnh hưởng giữ đủ event_id. Không sửa graph/OSM gốc.
3. Chỉ chặn khi review_status=approved, published=true, status=flooded/rising, đúng profile và nằm trong [valid_from,valid_until). Thời điểm lấy từ graph.evaluated_at, không lấy giờ hệ thống hoặc thời điểm dự kiến tới cạnh.
4. Chặn bằng loại cạnh khỏi yêu cầu tìm kiếm, không dùng trọng số phạt hữu hạn. Vẫn giữ lịch sử rẽ, chiều và các kiểm tra của graph gốc. Kiểm tra kết quả không chứa cạnh đã chặn, kể cả phần cạnh ảo tại đầu/cuối.
5. Nối điểm trên graph gốc trước khi áp dụng đóng đường. Nếu điểm ở giữa đoạn được chọn bị chặn, trả endpoint_blocked_by_flood; không tự snap sang đường khác. Tại node nút giao có thể rời qua cạnh không bị chặn; không mở lại cạnh bị ngập.
6. API /api/route?avoid_flood=true trả tuyến tránh cùng baseline và audit overlay. /api/flood trả polygon đang hiệu lực và cạnh bị ảnh hưởng. UI có checkbox so sánh, tuyến thường xám đứt, polygon đỏ, tuyến tránh theo màu chế độ hiện tại. Không đổi mặc định diagnostic; người dùng chủ động bật nếu coverage còn thiếu.

## Dữ liệu mẫu là GIẢ LẬP

flood-demo.synthetic.geojson là vùng nhỏ đặt tại Cầu Mới để kiểm tra thuật toán. Không có nguồn quan sát; KHÔNG phải tin ngập tại Cầu Mới. valid_from 07:00, valid_until 09:00 +07 ngày 29/10/2026 để khớp giờ graph; tuyệt đối không trình bày như dữ liệu ngập hiện hành.

Lược đồ tệp: FeatureCollection, data_mode synthetic hoặc reviewed_public_sources, features là các Feature Polygon một vòng đóng. Mỗi properties gồm event_id duy nhất, review_status (approved/pending/rejected), published boolean, status (flooded/rising/receded/unknown), action block, profiles (car/motorcycle/walking), observed_at, valid_from, valid_until có timezone, depth_cm số không âm hoặc null. observed_at không sau valid_from. Nguồn thật còn bắt buộc source_url https, source_title, reviewer. Các trường này phục vụ truy vết, không tự xác nhận chất lượng nguồn.

Tệp nguồn thật phải do quy trình admin xác minh vùng ảnh hưởng rồi xuất ra. Bản này chưa tự đọc FloodEvent/FloodObservation, chưa lấy ngập từ web, chưa có giao diện vẽ polygon và chưa chuyển điểm tin ngập thành bán kính một cách tự động. Không suy phạm vi ngập từ một tọa độ mơ hồ.

## Chính sách và giới hạn

- Không có ngưỡng độ sâu để tự kết luận ô tô, xe máy hay đi bộ đi qua an toàn. Số đo thiếu không đồng nghĩa không ngập; độ sâu mẫu không được dùng mở cạnh.
- Hết hạn, receded hoặc unknown không chứng minh đường khô/đi qua được. Audit đánh dấu rõ các mục không áp dụng. Tuyến trả về chỉ tránh những vùng đã nạp đang đủ điều kiện, không bảo đảm tránh mọi ngập.
- Polygon giao theo 2D, bảo thủ chặn cả cạnh cầu/hầm nếu giao footprint; chưa phân biệt tầng hoặc phạm vi ngập trên mặt cầu. Footprint và tầng cần admin rà lại trước dùng dữ liệu thật.
- Chỉ hỗ trợ Polygon đơn, không lỗ; từ chối Point/LineString/MultiPolygon, polygon tự cắt hoặc không hợp lệ. Không tự buffer điểm ngập. Các vùng tách nhau dùng nhiều Feature.
- Chưa dự báo diễn biến ngập, chưa đánh giá tại giờ xe tới từng cạnh, chưa có giao thông/thời gian đèn đỏ. Đánh giá tuyến theo snapshot tại một thời điểm cố định.
- Thống kê overlay là số cạnh có hướng; một đường hai chiều có thể tính hai cạnh. Không coi coverage=true của graph là dữ liệu ngập đầy đủ.

## Chạy trên PowerShell

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
$newGraph = Get-ChildItem data/routing-graph -Directory | Sort-Object Name -Descending | Select-Object -First 1
py -3 tools/routing-rules/routing_regression.py `
  --graph "$($newGraph.FullName)" `
  --cases tools/routing-rules/routing-regression-cases.json `
  --output data/routing-regression
```

Nếu graph khác mã pin, không sửa kỳ vọng chỉ để test qua; giữ graph đúng phiên bản hoặc đánh giá thay đổi trước khi lập bộ tham chiếu mới.

Dừng viewer cũ Ctrl+C rồi chạy:

```powershell
py -3 tools/routing-rules/graph_viewer.py `
  --graph "$($newGraph.FullName)" `
  --snapshot data/osm-survey/20261028T094314131389Z `
  --flood tools/routing-rules/flood-demo.synthetic.geojson
```

Mở http://localhost:8766, Ctrl+F5; bấm Nạp cặp điểm thử tránh ngập; với ô tô/xe máy, tự bật chế độ chẩn đoán nếu cần; bấm Tính tuyến. Checkbox so sánh được chọn bởi nút thử khi đã nạp tệp. Vùng đỏ là giả lập; xám đứt là baseline. Chiều dài hiển thị chính là tuyến tránh. Bỏ checkbox để tính tuyến thường. Chi tiết JSON chứa đầy đủ so sánh/audit.

Xuất so sánh CLI:

```powershell
py -3 tools/routing-rules/flood_overlay.py `
  --graph "$($newGraph.FullName)" `
  --flood tools/routing-rules/flood-demo.synthetic.geojson `
  --profile car --start "105.813533,20.998173" --end "105.841535,21.005882" `
  --diagnostic --output data/routing-flood
```

## Xác minh local

310 tests đạt; 9/9 ca regression đạt; Python compile và JavaScript syntax đạt. Kiểm thử HTTP so sánh, duyệt/xuất bản, khung giờ, hết hạn, thiếu độ sâu, giao biên polygon, hai chiều, không có đường vòng và không tự đổi điểm nối. Chưa có kiểm thử tự động trình duyệt đồ họa.

Kịch bản giả lập Cầu Mới, cùng điểm Nguyễn Trãi → Giải Phóng:

| Phương tiện | Thường (m) | Tránh giả lập (m) |
|---|---:|---:|
| car | 4070.08 | 4228.54 |
| motorcycle | 4070.08 | 4226.46 |
| walking | 3751.16 | 3810.46 |

Replay cả 6 tuyến qua toàn bộ RestrictionMachine không vi phạm quy tắc rẽ đã đánh giá; tuyến tránh không chứa cạnh bị đóng; graph nguồn không bị sửa. validation/ lưu các kết quả để đối chiếu, không phải dữ liệu ngập thực tế.

Bước tiếp: xác định nguồn công khai và phạm vi ngập đủ rõ cho một số trường hợp thật, nối dữ liệu đã được admin duyệt sang lược đồ này, rồi kiểm tra ánh xạ/tầng đường trước khi tích hợp ứng dụng chính.
