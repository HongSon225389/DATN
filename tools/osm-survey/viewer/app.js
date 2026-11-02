const $ = id => document.getElementById(id);
let map, base, info, roadLayer, turnLayer, barrierLayer, boundaryLayer, selectedLayer;
let selected = null, viewData = null, currentTab = 'visible', samples = [], reviews = {};
let controller = null, detailController = null, timer, storageKey, tileErrors = 0;
const names = {name:'Tên',highway:'Loại đường',oneway:'Chiều chung',motorcar:'Quyền ô tô',motorcycle:'Quyền xe máy',foot:'Quyền đi bộ',access:'Quyền chung',maxspeed:'Giới hạn tốc độ', 'maxspeed:forward':'Tốc độ theo chiều way','maxspeed:backward':'Tốc độ ngược chiều way',bridge:'Cầu',tunnel:'Hầm',layer:'Tầng',surface:'Mặt đường',width:'Chiều rộng'};
const barrierNames={gate:'Cổng',lift_gate:'Thanh chắn nâng',bollard:'Cọc chắn',cycle_barrier:'Rào chắn lối xe đạp',fence:'Hàng rào',wall:'Tường',block:'Khối chắn',entrance:'Lối vào'};
const turnNames={no_left_turn:'Cấm rẽ trái',no_right_turn:'Cấm rẽ phải',no_u_turn:'Cấm quay đầu',no_straight_on:'Cấm đi thẳng',only_left_turn:'Chỉ được rẽ trái',only_right_turn:'Chỉ được rẽ phải',only_straight_on:'Chỉ được đi thẳng',only_u_turn:'Chỉ được quay đầu'};

function error(message) { $('error').textContent=message; $('error').hidden=!message; }
async function get(url,signal) { const response=await fetch(url,{signal}); const data=await response.json(); if(!response.ok) throw new Error(data.message||`HTTP ${response.status}`); return data; }
function bboxString() { const b=map.getBounds(); return [Math.max(-180,b.getWest()),Math.max(-79.99,b.getSouth()),Math.min(180,b.getEast()),Math.min(79.99,b.getNorth())].join(','); }
function fitBox(b) { map.fitBounds([[b[1],b[0]],[b[3],b[2]]],{padding:[20,20]}); }
function color(roadClass) { if(['footway','path','steps','pedestrian','corridor'].includes(roadClass))return '#22836a'; if(['primary','primary_link','secondary','secondary_link','trunk','trunk_link','motorway','motorway_link'].includes(roadClass))return '#a85826';return '#416887'; }
function textTooltip(text) { const span=document.createElement('span'); span.textContent=text; return span; }
function params() { return new URLSearchParams({bbox:bboxString(),scope:$('scope').value,geometry:$('geometry').value,class:$('road-class').value,flag:$('flag').value,q:$('query').value.trim()}); }
function schedule() { clearTimeout(timer); timer=setTimeout(loadViewport,220); }

async function loadViewport() {
  controller?.abort(); const request=new AbortController(); controller=request;
  $('status').textContent='Đang tải đường trong khung nhìn…'; error('');
  try {
    const data=await get('/api/roads?'+params(),request.signal); if(request.signal.aborted)return;
    viewData=data;
    roadLayer.clearLayers(); roadLayer.addData(data);
    turnLayer.clearLayers(); turnLayer.addData(data.turns);
    barrierLayer.clearLayers(); barrierLayer.addData(data.barriers);
    const extra=data.truncated?' Đang giới hạn 3.000 đường; phóng to hoặc lọc thêm để xem phần còn lại.':'';
    const geometryLabel=data.geometry==='linear'?'đường dạng tuyến':data.geometry==='area'?'đường dạng vùng':'way tuyến/vùng';
    $('status').textContent=`${data.shown.toLocaleString('vi-VN')} / ${data.total.toLocaleString('vi-VN')} ${geometryLabel} phù hợp trong khung.${extra} Cùng bộ lọc trong khung: ${data.linear_total.toLocaleString('vi-VN')} tuyến + ${data.area_total.toLocaleString('vi-VN')} vùng. Có ${data.turn_total} hạn chế rẽ và ${data.barrier_total} rào chắn; chỉ hiện khi bật lớp, tối đa 1.000 điểm mỗi loại.`;
    if(currentTab==='visible')renderList();
    selectedLayer.bringToFront();
  } catch(e) { if(e.name!=='AbortError') {error(e.message);$('status').textContent='Chưa cập nhật được lớp đường; đang giữ kết quả trước.';} }
}

function addTagList(target,tags) {
  target.replaceChildren();
  for(const key of Object.keys(tags).sort()) {
    const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');
    dt.textContent=key;
    dd.textContent=tags[key]; row.append(dt,dd);target.append(row);
  }
}
function showPrimary(d) {
  const rows=[];const tags=d.tags;
  const add=(label,value)=>rows.push([label,value]);
  const tag=(key,label,required=false)=>{if(tags[key]!=null||required)add(label||names[key]||key,tags[key]??'Chưa có trong dữ liệu');};
  if(d.kind==='way') {
    $('detail-heading').textContent='Thông tin đường';
    for(const key of ['name','highway','oneway'])tag(key,names[key],true);
    for(const key of Object.keys(names).filter(k=>!['name','highway','oneway'].includes(k)))tag(key,names[key]);
    for(const key of Object.keys(tags).filter(k=>!Object.hasOwn(names,k)&&/^(access|vehicle|motor_vehicle|motorcar|motorcycle|foot|oneway|maxspeed)(:|$)/.test(k)))tag(key,key);
    add('Hình học',tags.area==='yes'?'Dạng vùng — chưa phải cạnh tuyến tính':'Dạng tuyến — chưa phải cạnh định tuyến');
    add('Chiều dài toàn way',`${Number(d.feature.properties.length_m).toLocaleString('vi-VN')} m`);
    if(!Object.keys(tags).some(k=>k==='maxspeed'||k.startsWith('maxspeed:')))add('Thông tin tốc độ','Chưa có maxspeed*; chưa tự suy ra giới hạn');
    if(!['access','vehicle','motor_vehicle','motorcar','motorcycle','foot'].some(k=>Object.hasOwn(tags,k)))add('Thông tin quyền đi','Chưa có thuộc tính tường minh; cần bảng quy tắc');
  } else if(d.kind==='relation') {
    $('detail-heading').textContent='Quy tắc chuyển hướng gốc';
    const ruleKeys=Object.keys(tags).filter(k=>k==='restriction'||k.startsWith('restriction:'));
    if(!ruleKeys.length)add('Loại hạn chế','Chưa có thuộc tính restriction*');
    for(const key of ruleKeys)add(key,turnNames[tags[key]]?`${turnNames[tags[key]]} (${tags[key]})`:tags[key]);
    tag('except','Ngoại lệ phương tiện');
    for(const key of Object.keys(tags).filter(k=>k.includes(':conditional')&&!ruleKeys.includes(k)))tag(key,key);
    for(const role of ['from','via','to'])add({from:'Từ đường (from)',via:'Qua nút/đường (via)',to:'Sang đường (to)'}[role],d.members.filter(m=>m.role===role).map(m=>`${m.type} ${m.ref}`).join(', ')||'Chưa có thành viên');
    add('Cấu trúc',d.simple_via_node_shape?'Một from-way / via-node / to-way':'Phức tạp — cần xem các thành viên');
    add('Đủ thành viên trong file',d.members_complete?'Có':'Chưa đủ');
    add('Áp dụng vào định tuyến','Chưa áp dụng; đây là dữ liệu gốc');
  } else {
    $('detail-heading').textContent='Thông tin cổng / rào chắn';
    add('Loại',barrierNames[tags.barrier]?`${barrierNames[tags.barrier]} (${tags.barrier})`:tags.barrier||'Chưa rõ');
    for(const key of ['name','access','vehicle','motor_vehicle','motorcar','motorcycle','foot','bicycle','locked','opening_hours','width','maxwidth','height','maxheight','operator'])tag(key,({locked:'Trạng thái khóa',opening_hours:'Giờ mở cửa',bicycle:'Quyền xe đạp',maxwidth:'Giới hạn rộng',height:'Chiều cao',maxheight:'Giới hạn cao',operator:'Đơn vị quản lý'})[key]||names[key]||key);
    for(const key of Object.keys(tags).filter(k=>k.includes(':conditional')))tag(key,key);
    if(!Object.hasOwn(tags,'locked'))add('Trạng thái khóa','Chưa rõ — không mặc định đang mở');
    add('Quyền qua thực tế','Chưa kết luận từ riêng loại rào chắn');
  }
  const target=$('important-tags');target.replaceChildren();
  for(const [label,value] of rows){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=String(value);row.append(dt,dd);target.append(row);}
}
function reviewKey(kind,id) { return kind+':'+id; }
function localTime(value) { if(!value)return '';const d=new Date(value);if(!Number.isFinite(d.getTime()))return '';const pad=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

async function select(kind,id,focus=true,testCase='') {
  detailController?.abort();const request=new AbortController();detailController=request;
  error('');
  try {
    const d=await get(`/api/detail/${kind}/${id}`,request.signal);if(request.signal.aborted)return;
    selected=d;selectedLayer.clearLayers();
    if(d.member_lines)selectedLayer.addData(d.member_lines);
    if(d.feature)selectedLayer.addData(d.feature);
    const bounds=selectedLayer.getBounds();
    if(focus&&bounds.isValid())map.fitBounds(bounds,{padding:[40,40],maxZoom:18});
    selectedLayer.bringToFront();
    $('detail').hidden=false;
    $('detail-title').textContent=d.tags.name||`${kind==='relation'?'Hạn chế rẽ':kind==='node'?'Rào chắn':'Đường nguồn'} ${id}`;
    $('detail-kind').textContent=`${kind} · ${id} · ${info.dataset_version}`;
    $('osm-link').href=`https://www.openstreetmap.org/${kind}/${id}`;
    const warnings=['Thuộc tính gốc chưa được diễn giải thành quy tắc định tuyến. Thiếu tag không đồng nghĩa cho phép hoặc cấm.'];
    if(kind==='relation') {
      warnings.push('Màu xanh lam nhạt: from; cam: to; xanh đậm: via. Đây không phải chỉ dẫn rẽ.');
      if(d.feature?.properties.location_method==='via_way_representative')warnings.push('Điểm tím là vị trí đại diện của via-way, không phải tọa độ nút rẽ chính xác.');
      if(!d.feature)warnings.push('Chưa xác định được vị trí đại diện.');
      if(!d.simple_via_node_shape)warnings.push('Quan hệ có cấu trúc phức tạp, cần xem thành viên.');
    }
    if(d.flags?.includes('area'))warnings.push('Đường dạng vùng; chưa phải cạnh tuyến tính.');
    $('detail-warning').textContent=warnings.join(' ');$('detail-warning').hidden=false;
    showPrimary(d);addTagList($('all-tags'),d.tags);
    const members=$('members');members.replaceChildren();
    if(d.members?.length){const title=document.createElement('h3');title.textContent='Thành viên quan hệ';members.append(title);for(const m of d.members){const b=document.createElement('button');b.type='button';b.className='member-link';b.textContent=`${m.role} · ${m.type} ${m.ref}`;b.onclick=()=>select(m.type,m.ref,true);members.append(b);}}
    if(d.related?.length){const title=document.createElement('h3');title.textContent='Quan hệ rẽ có liên quan';members.append(title);for(const rel of d.related){const b=document.createElement('button');b.type='button';b.className='member-link';b.textContent=String(rel);b.onclick=()=>select('relation',rel,true);members.append(b);}}
    const saved=reviews[reviewKey(kind,id)];
    $('case').value=saved?.test_case||testCase;
    $('conclusion').value=saved?.conclusion||'chưa xác định';
    $('evidence').value=saved?.evidence_url||'';
    $('observed').value=localTime(saved?.observed_at);
    $('note').value=saved?.note||'';
    $('save-status').textContent=saved?'Đang xem phiếu đã lưu.':'Chưa có phiếu. Chỉ được lưu sau khi bạn bấm nút.';
    renderList();
    $('detail').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(e){if(e.name!=='AbortError')error(e.message);}
}

function renderList() {
  const list=$('item-list');list.replaceChildren();
  let items=[];
  if(currentTab==='visible') {
    items=(viewData?.listing||[]).map(x=>({kind:'way',id:x.id,title:x.name||`Đường ${x.id}`,subtitle:x.highway}));
    $('list-note').textContent='Tối đa 60 đường trong khung hiện tại. Bấm trực tiếp trên bản đồ để xem đường khác. Bộ lọc chỉ áp dụng lớp đường; rẽ và rào chắn có công tắc riêng.';
  } else if(currentTab==='samples') {
    items=samples.map(x=>({...x,title:x.case,subtitle:`${x.kind} ${x.id}`,testCase:x.case}));
    $('list-note').textContent='Mẫu gợi ý có chủ đích, chưa được xác minh và không đại diện thống kê cho toàn khu vực. Bấm từng mục để kiểm tra.';
  } else {
    items=Object.values(reviews).map(x=>({kind:x.osm_type,id:x.osm_id,title:x.test_case||`${x.osm_type} ${x.osm_id}`,subtitle:x.conclusion}));
    $('list-note').textContent='Phiếu đã lưu cho đúng phiên bản dữ liệu đang mở.';
  }
  for(const item of items){const b=document.createElement('button');b.type='button';b.className='item'+(selected?.id===item.id&&selected?.kind===item.kind?' selected':'');const strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=item.title;span.textContent=item.subtitle;b.append(strong,span);b.onclick=()=>select(item.kind,item.id,true,item.testCase||'');list.append(b);}
  if(!items.length){const p=document.createElement('p');p.className='muted';p.textContent='Chưa có mục phù hợp.';list.append(p);}
  $('review-count').textContent=Object.keys(reviews).length+' phiếu';
}

function persist(next) { localStorage.setItem(storageKey,JSON.stringify(next));reviews=next;renderList(); }
function safeCell(value) { const s=String(value??'');return /^\s*[=+@-]/.test(s)?"'"+s:s; }
function csvCell(value) { return '"'+safeCell(value).replaceAll('"','""')+'"'; }
function download(name,content,type) { const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function validateBackup(data) {
  if(data?.dataset_version!==info.dataset_version||!Array.isArray(data.reviews)||data.reviews.length>10000)throw new Error('File không đúng phiên bản dữ liệu hoặc cấu trúc sao lưu.');
  const next={...reviews};
  for(const r of data.reviews){if(!['way','node','relation'].includes(r.osm_type)||!Number.isSafeInteger(r.osm_id)||r.osm_id<=0||!['đúng','cần bổ sung','chưa xác định'].includes(r.conclusion))throw new Error('Phiếu không hợp lệ.');for(const k of ['test_case','evidence_url','observed_at','note'])if(typeof r[k]!=='string'||r[k].length>4000)throw new Error('Nội dung phiếu không hợp lệ.');next[reviewKey(r.osm_type,r.osm_id)]={osm_type:r.osm_type,osm_id:r.osm_id,test_case:r.test_case,evidence_url:r.evidence_url,observed_at:r.observed_at,conclusion:r.conclusion,note:r.note};}
  return next;
}

async function init(){
  if(typeof L==='undefined')throw new Error('Không tải được Leaflet. Kiểm tra thư mục viewer/vendor.');
  info=await get('/api/info');storageKey='hanoi-osm-review:'+info.dataset_version;
  try{const raw=localStorage.getItem(storageKey);reviews=raw?validateBackup({dataset_version:info.dataset_version,reviews:Object.values(JSON.parse(raw))}):{};}catch{reviews={};error('Không đọc được phiếu đã lưu. Kiểm tra bản sao lưu trước khi ghi phiếu mới.');}
  $('dataset').textContent=`${info.snapshot} · ${info.dataset_version}${info.synthetic?' · DỮ LIỆU KIỂM THỬ NHÂN TẠO':''}`;
  for(const [cls,count] of Object.entries(info.classes)){const o=document.createElement('option');o.value=cls;o.textContent=`${cls} (${count.toLocaleString('vi-VN')})`;$('road-class').append(o);}
  map=L.map('map',{preferCanvas:true,minZoom:10,maxZoom:20});
  selectedLayer=L.geoJSON(null,{style:f=>({color:f.properties?.role==='from'?'#0f82a8':f.properties?.role==='to'?'#d25735':'#1769e0',weight:8,opacity:.9}),pointToLayer:(_,p)=>L.circleMarker(p,{radius:10,color:'#1769e0',weight:4,fillOpacity:.2})});
  base=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,referrerPolicy:'strict-origin-when-cross-origin',attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
  base.on('tileerror',()=>{if(++tileErrors>=3)$('base-error').hidden=false;});
  boundaryLayer=L.geoJSON(info.download_area,{style:{color:'#70849a',weight:1,dashArray:'5 5',fill:false},interactive:false}).addTo(map);
  L.geoJSON(info.study_area,{style:{color:'#1769d2',weight:2,dashArray:'7 5',fill:false},interactive:false}).addTo(map);
  roadLayer=L.geoJSON(null,{style:f=>({color:color(f.properties.highway),weight:3,opacity:.8}),onEachFeature:(f,l)=>{l.bindTooltip(()=>textTooltip(`${f.properties.name||'Chưa có tên'} · ${f.properties.highway} · ${f.properties.id}`));l.on('click',e=>{L.DomEvent.stopPropagation(e);select('way',f.properties.id,false);});}}).addTo(map);
  turnLayer=L.geoJSON(null,{pointToLayer:(_,p)=>L.circleMarker(p,{radius:6,color:'#fff',weight:1,fillColor:'#8a4bba',fillOpacity:.9}),onEachFeature:(f,l)=>{l.bindTooltip(()=>textTooltip(f.properties.location_method==='via_way_representative'?'Hạn chế rẽ · vị trí đại diện via-way':'Hạn chế rẽ · '+f.properties.osm_id));l.on('click',()=>select('relation',f.properties.osm_id,false));}});
  barrierLayer=L.geoJSON(null,{pointToLayer:(_,p)=>L.circleMarker(p,{radius:5,color:'#fff',weight:1,fillColor:'#e48720',fillOpacity:1}),onEachFeature:(f,l)=>{l.bindTooltip(()=>textTooltip('Rào chắn · '+f.properties.barrier));l.on('click',()=>select('node',f.properties.osm_node_id,false));}});
  selectedLayer.addTo(map);fitBox(info.study_bbox);map.on('moveend',schedule);
  for(const id of ['scope','road-class','geometry'])$(id).onchange=schedule;
  $('flag').onchange=()=>{if($('flag').value==='area')$('geometry').value='area';schedule();};
  $('search-form').onsubmit=e=>{e.preventDefault();schedule();};
  $('query').oninput=()=>{if(!$('query').value)schedule();};
  $('refresh').onclick=loadViewport;$('reset-view').onclick=()=>{fitBox(info.study_bbox);schedule();};
  $('show-turns').onchange=e=>e.target.checked?turnLayer.addTo(map):map.removeLayer(turnLayer);
  $('show-barriers').onchange=e=>e.target.checked?barrierLayer.addTo(map):map.removeLayer(barrierLayer);
  $('show-base').onchange=e=>{if(e.target.checked)base.addTo(map);else{map.removeLayer(base);$('base-error').hidden=true;}};
  $('close-detail').onclick=()=>{selected=null;selectedLayer.clearLayers();$('detail').hidden=true;renderList();};
  for(const tab of ['visible','samples','saved'])$('tab-'+tab).onclick=async()=>{currentTab=tab;for(const t of ['visible','samples','saved'])$('tab-'+t).setAttribute('aria-pressed',String(t===tab));if(tab==='samples'&&!samples.length){try{samples=await get('/api/samples');}catch(e){error(e.message);}}renderList();};
  $('review-form').onsubmit=e=>{e.preventDefault();if(!selected)return;const conclusion=$('conclusion').value;const evidence=$('evidence').value.trim();if(conclusion==='đúng'&&!evidence){$('save-status').textContent='Kết luận đúng cần đường dẫn nguồn đối chiếu. Chưa có nguồn hãy chọn chưa xác định.';return;}const observed=$('observed').value;const d=observed?new Date(observed):null;if(d&&!Number.isFinite(d.getTime())){$('save-status').textContent='Thời gian không hợp lệ.';return;}const r={osm_type:selected.kind,osm_id:selected.id,test_case:$('case').value.trim(),evidence_url:evidence,observed_at:d?d.toISOString():'',conclusion,note:$('note').value.trim()};try{persist({...reviews,[reviewKey(selected.kind,selected.id)]:r});$('save-status').textContent='Đã lưu trên trình duyệt. Nhớ xuất CSV hoặc sao lưu JSON.';}catch{$('save-status').textContent='Không lưu được: trình duyệt chặn lưu trữ hoặc hết dung lượng. Hãy sao lưu phiếu hiện có.';}};
  $('export-csv').onclick=()=>{if(!Object.keys(reviews).length){error('Chưa có phiếu để xuất.');return;}const fields=['osm_type','osm_id','test_case','evidence_url','observed_at','conclusion','note'];const lines=[fields.map(csvCell).join(','),...Object.values(reviews).map(r=>fields.map(k=>csvCell(r[k])).join(','))];download('manual-review.csv','\ufeff'+lines.join('\r\n'),'text/csv;charset=utf-8');};
  $('export-json').onclick=()=>download('manual-review-'+info.dataset_version+'.json',JSON.stringify({dataset_version:info.dataset_version,exported_at:new Date().toISOString(),reviews:Object.values(reviews)},null,2),'application/json');
  $('import-json').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>5*1024*1024)throw new Error('File quá 5 MB.');persist(validateBackup(JSON.parse(await f.text())));error('');$('status').textContent='Đã khôi phục phiếu cùng phiên bản; mục trùng được thay bằng bản trong file.';}catch(err){error(err.message);}finally{e.target.value='';}};
  renderList();await loadViewport();
}
init().catch(e=>{error(e.message);$('status').textContent='Không khởi tạo được công cụ. Kiểm tra cửa sổ Python.';});
