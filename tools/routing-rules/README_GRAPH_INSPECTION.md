# Phân tích cụm và xem graph

Gói bổ sung sau Hanoi_Routing_Graph.zip. Giải nén vào gốc dự án. Python chuẩn, không pip/npm. Thư viện Leaflet đi kèm và giấy phép MIT; bản đồ nền OSM cần mạng, lớp graph đọc từ máy.

## 1. Kiểm thử

```powershell
py -3 -m unittest discover -s tools/routing-rules -p "test_*.py" -v
```

Dự kiến 204 tests (190 trước + 14 mới). Có kiểm tra thành viên WCC/SCC, mạng thời gian, giới hạn viewport, bộ lọc, hash graph/snapshot, đọc/ghi JSON, HTTP allowlist, Host và socket bị ngắt. Đã kiểm tra cú pháp JavaScript, HTTP và dữ liệu thật; chưa thực hiện kiểm thử hình ảnh trình duyệt tự động.

## 2. Xuất báo cáo graph đã có

```powershell
py -3 tools/routing-rules/inspect_graph.py --graph data/routing-graph/20261029T050622003176Z --snapshot data/osm-survey/20261028T094314131389Z --output data/routing-graph-inspection
```

Không dựng lại graph. Đường --graph là thư mục kết quả trên máy bạn, không phải file gzip. Nếu chạy graph lần khác cần đổi đường này. Graph/snapshot không cùng hash/phiên bản thì từ chối.

File kết quả:

- components.csv: toàn bộ cụm của ba hồ sơ, hai loại trọng số, WCC và SCC, số node/cạnh nội bộ/cạnh biên, terminal port, bbox và tỷ lệ node. ID cụm được đánh số theo số node giảm dần, hòa thì theo node ID nhỏ nhất; không dùng chung ID cụm giữa các hồ sơ/trọng số/WCC-SCC.
- pending-relations.csv và .json: mọi relation unresolved/invalid, phân biệt có incoming guard hoặc chưa định vị. Chứa URL OSM, tags/members gốc, tọa độ thành viên tìm được và khung gợi ý.
- *.component-membership.json.gz: ánh xạ từng graph node về cụm WCC/SCC theo từng mạng trọng số. Không phải graph bị cắt/ghi đè.
- metadata.json: graph_version, phiên bản snapshot, scope và coverage_changed=false.

WCC/SCC vẫn là topology trước kiểm tra trạng thái lịch sử rẽ. Không báo số cụm thành số vùng có thể tìm tuyến hợp lệ đầy đủ. Node terminal do cổng tách được tính như trong graph.

## 3. Mở bản đồ kiểm tra

```powershell
py -3 tools/routing-rules/graph_viewer.py --graph data/routing-graph/20261029T050622003176Z --snapshot data/osm-survey/20261028T094314131389Z
```

Mở http://localhost:8766 và giữ terminal chạy. Có thể giữ viewer khảo sát cũ ở 8765, nhưng không cần npm/backend/Mongo cho hai công cụ này. Ctrl+C để dừng. Nếu 8766 đang bận, mở tab hiện có hoặc chọn --port 8767. Server chỉ bind 127.0.0.1, chỉ GET và không ghi sửa graph/phiếu.

Công cụ đọc các graph và tính membership khi khởi động, có thể cần chờ trước khi báo URL sẵn sàng.

### Cách xem

1. Chọn phương tiện, mạng khoảng cách/thời gian và WCC/SCC.
2. Chọn cụm lớn nhất hoặc cụm nhỏ trong danh sách (hiển thị tối đa 100 cụm lớn; CSV chứa đầy đủ). Đổi bộ lọc để tính đúng số cụm tương ứng.
3. Phóng to: tối đa 2.000 cạnh có hướng mỗi khung bản đồ, có thông báo khi bị giới hạn. Hai chiều có thể vẽ chồng; tooltip/chi tiết ghi hướng theo thứ tự nguồn, chưa có mũi tên đường đi.
4. Bật node bị chặn (đỏ). Click để xem trạng thái và lý do. Lớp node chặn độc lập bộ lọc cụm, hiển thị tối đa 1.000 node trong khung và có thông báo giới hạn.
5. Click cạnh để xem way ID, segment, chiều, chiều dài, chi phí và nguồn giả định. Màu cạnh biểu thị cụm của node nguồn, không biểu thị an toàn/ngập. SCC có cạnh biên đi ra/vào; màu nguồn có thể thuộc cụm khác khi lọc theo cạnh biên.
6. Chọn relation cần rà soát để về bbox thành viên. Bộ lọc cụm về Tất cả. Không hiện được khung nếu không có tọa độ thành viên trong raw. Chi tiết có URL OSM; không tự sửa hoặc tự bỏ quan hệ.
7. Nếu nền báo lỗi ô bản đồ thì tắt Bản đồ nền OSM; graph vẫn xem được. Không tự tải/cào hàng loạt tile.

Tên/nhận xét OSM được hiển thị dưới dạng văn bản, không chèn HTML từ dữ liệu. Chi tiết không phải chỉ dẫn rẽ hoặc kết quả tìm đường.

## Giới hạn quan trọng

Khung thành viên chỉ chỉ ra tọa độ của phần tử có mặt. Quan hệ thiếu from/to/via vẫn có thể có một khung đẹp nhưng chưa biết hướng vào hay phạm vi ảnh hưởng. Không dùng khung này để mở coverage hoặc kết luận lỗi ở ngoài khu vực tuyến.

Node bị chặn và cạnh trong graph có thể giúp quan sát nơi mạng tách, nhưng chưa có thuật toán quy kết nguyên nhân từng cụm (biên vùng, quyền đi, cổng, hình học...). Không tự mở quyền/cổng để nối mạng. Những cạnh đã loại không được vẽ như cạnh graph hiện hành.

Chưa sửa graph, chưa thay policy, chưa nâng coverage, chưa có Dijkstra hoặc snap. Cụm lớn có thể dùng để chọn vùng chẩn đoán; ô tô/xe máy vẫn bị khóa trong chế độ nghiêm ngặt khi còn restriction chưa định vị.

Thêm `/data/routing-graph-inspection/` vào .gitignore. Mã trong tools/routing-rules và báo cáo tóm tắt trong docs/routing có thể quản lý bằng Git; không cần commit các graph hoặc ZIP đầu vào.
