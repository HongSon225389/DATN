'use strict';
const el=id=>document.getElementById(id),map=L.map('map',{preferCanvas:true}).setView([21.015,105.825],13);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
tiles.on('tileerror',()=>{el('tileWarning').hidden=false;});
let floodTestPair=null;let info,sequence=0,infoSequence=0,timer,controller,roads=L.layerGroup().addTo(map),blocks=L.layerGroup().addTo(map),hint=L.layerGroup().addTo(map);
const colors=['#1768a8','#168269','#ad6633','#7547af','#c34573','#626f7a'];
const params=()=>new URLSearchParams({profile:el('profile').value,weight:el('weight').value,kind:el('kind').value});
async function get(url,signal){const r=await fetch(url,{signal});if(!r.ok)throw Error('Không đọc được dữ liệu ('+r.status+')');return r.json();}
function box(b){return [[b[1],b[0]],[b[3],b[2]]];}
function focus(b){if(b)map.fitBounds(box(b),{padding:[25,25],maxZoom:17});}
async function refreshInfo(){if(typeof invalidateRoute==='function'){invalidateRoute();resetAttachments();}const current=++infoSequence;++sequence;if(controller)controller.abort();try{const data=await get('/api/info?'+params());if(current!==infoSequence)return;info=data;
 const flood=await get('/api/flood?'+new URLSearchParams({profile:data.profile}));if(current!==infoSequence)return;
 floodTestPair=flood.test_pair||null;floodLayer.clearLayers();if(flood.blocked_features)L.geoJSON(flood.blocked_features,{style:{color:'#d32f2f',weight:9,opacity:.9}}).addTo(floodLayer);L.geoJSON(flood.active_regions,{style:{color:'#c62828',fillColor:'#ef5350',fillOpacity:.25,weight:2}}).addTo(floodLayer);
 el('floodStatus').textContent=flood.data_mode==='not_loaded'?'Chưa nạp tệp vùng ngập.':(flood.data_mode==='synthetic'?'GIẢ LẬP — không phải tình trạng ngập thực tế. ':'Nguồn công khai đã duyệt — phạm vi quan sát còn thiếu. ')+Object.keys(flood.blocked_edges).length+' cạnh có hướng bị chặn; thời điểm '+flood.evaluated_at;
 if(flood.applicable_profile&&flood.applicable_profile!==data.profile)el('floodStatus').textContent+=' Kịch bản chỉ áp dụng '+flood.applicable_profile+', không chặn phương tiện đang chọn.';
 el('avoidFlood').disabled=flood.data_mode==='not_loaded'||Boolean(flood.applicable_profile&&flood.applicable_profile!==data.profile);if(el('avoidFlood').disabled)el('avoidFlood').checked=false;
 el('version').textContent=info.graph_version;
 el('component').replaceChildren(new Option('Tất cả','0'));for(const c of info.components)el('component').add(new Option(c.component_id+' · '+c.node_count.toLocaleString('vi-VN')+' node',String(c.component_id)));
 const list=el('pending');list.replaceChildren();for(const r of info.pending){const b=document.createElement('button');b.type='button';b.textContent=r.relation_id+' · '+(r.locality==='unlocated'?'Chưa định vị hướng vào':'Có hướng vào')+' · '+r.status;b.onclick=()=>{el('component').value='0';hint.clearLayers();if(r.member_hint_bbox){L.rectangle(box(r.member_hint_bbox),{color:'#8344ae',weight:2,fill:false}).addTo(hint);focus(r.member_hint_bbox);}el('detail').textContent=JSON.stringify(r,null,2);};list.append(b);}
 if(!info.pending.length)list.textContent='Không có quan hệ pending trong tập quy tắc của hồ sơ này.';hint.clearLayers();if(info.components.length){const c=info.components[0];focus([c.west,c.south,c.east,c.north]);}await refreshMap();if(current===infoSequence)window.dispatchEvent(new Event('graph-profile-ready'));
}catch(e){el('status').textContent=e.message;}}
async function refreshMap(){const current=++sequence;if(controller)controller.abort();controller=new AbortController();const p=params(),b=map.getBounds();p.set('bbox',[b.getWest(),b.getSouth(),b.getEast(),b.getNorth()].join(','));p.set('component',el('component').value);
try{const data=await get('/api/viewport?'+p,controller.signal);if(current!==sequence)return;roads.clearLayers();blocks.clearLayers();L.geoJSON(data,{style:f=>({color:colors[(f.properties.component_from-1)%colors.length],weight:3,opacity:.8}),onEachFeature:(f,l)=>{const label=document.createElement('span');label.textContent=f.properties.name+' · '+f.properties.direction+' · '+f.properties.edge_id;l.bindTooltip(label);l.on('click',async(event)=>{if(window.reviewEdgeClick&&window.reviewEdgeClick(f,event))return;const profile=el('profile').value;try{const d=await get('/api/detail?'+new URLSearchParams({profile,edge:f.properties.edge_id}));if(profile===el('profile').value)el('detail').textContent=JSON.stringify(d,null,2);}catch(e){el('detail').textContent=e.message;}});}}).addTo(roads);
if(el('blocked').checked)for(const n of data.blocked_nodes){const m=L.circleMarker([n.lat,n.lon],{radius:5,color:'#fff',weight:1,fillColor:'#dc3545',fillOpacity:.9}).addTo(blocks);m.on('click',()=>{el('detail').textContent=JSON.stringify(n,null,2);});}
const summary=info&&info.profile===p.get('profile')&&info.weight===p.get('weight')&&info.kind===p.get('kind')?info.summary:null;el('status').textContent=`${data.returned_edges.toLocaleString('vi-VN')} / ${data.total_matching_edges.toLocaleString('vi-VN')} cạnh trong khung${data.truncated?' — đang giới hạn 2.000; phóng to để xem thêm':''}.\nNode bị chặn trong khung: ${data.total_blocked_nodes_in_view}${data.blocked_truncated?' (chỉ hiện 1.000)':''}.\nCoverage của hồ sơ: ${summary?summary.strict_coverage_complete:'?'} · Cụm trong danh sách: tối đa 100/${info?info.component_count:0}.\nChưa xét khả năng đi giữa mọi cặp điểm có lịch sử rẽ.`;
}catch(e){if(e.name!=='AbortError'&&current===sequence)el('status').textContent=e.message;}}
for(const id of ['profile','weight','kind'])el(id).onchange=refreshInfo;
el('component').onchange=()=>{const c=info.components.find(x=>String(x.component_id)===el('component').value);if(c)focus([c.west,c.south,c.east,c.north]);refreshMap();};
el('blocked').onchange=refreshMap;el('base').onchange=()=>{if(el('base').checked)tiles.addTo(map);else{map.removeLayer(tiles);el('tileWarning').hidden=true;}};
el('home').onclick=()=>{if(info&&info.components.length){const c=info.components[0];focus([c.west,c.south,c.east,c.north]);}};
map.on('moveend',()=>{clearTimeout(timer);timer=setTimeout(refreshMap,150);});

// Requested points and returned route are distinct from graph controls.
let routeStart=null,routeEnd=null,pickTarget=null,routeSeq=0;
const floodLayer=L.layerGroup().addTo(map);
const pointLayer=L.layerGroup().addTo(map),routeLayer=L.layerGroup().addTo(map),snapLayer=L.layerGroup().addTo(map);
function invalidateRoute(){++routeSeq;routeLayer.clearLayers();snapLayer.clearLayers();el('routeStatus').textContent='';}
function resetAttachments(){for(const id of ['startRoad','endRoad'])el(id).replaceChildren(new Option('Tự chọn đoạn gần nhất',''));el('attachmentInfo').textContent='';}
function drawPoints(){resetAttachments();pointLayer.clearLayers();for(const [point,label,color] of [[routeStart,'Điểm đi','#168269'],[routeEnd,'Điểm đến','#7547af']])if(point){const marker=L.circleMarker([point[1],point[0]],{radius:8,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(pointLayer);marker.bindTooltip(label);}
 el('routePoints').textContent='Đi: '+(routeStart?routeStart.map(v=>v.toFixed(6)).join(', '):'chưa chọn')+' · Đến: '+(routeEnd?routeEnd.map(v=>v.toFixed(6)).join(', '):'chưa chọn');}
function selectPoint(which){pickTarget=which;map.getContainer().style.cursor='crosshair';el('routeStatus').textContent='Bấm bản đồ để chọn '+(which==='start'?'điểm đi':'điểm đến');}
el('pickStart').onclick=()=>selectPoint('start');el('pickEnd').onclick=()=>selectPoint('end');
el('clearStart').onclick=()=>{routeStart=null;pickTarget=null;map.getContainer().style.cursor='';invalidateRoute();drawPoints();};
el('clearEnd').onclick=()=>{routeEnd=null;pickTarget=null;map.getContainer().style.cursor='';invalidateRoute();drawPoints();};
el('clearRoute').onclick=()=>{routeStart=null;routeEnd=null;pickTarget=null;map.getContainer().style.cursor='';invalidateRoute();drawPoints();};
map.on('click',event=>{if(window.reviewMapClick&&window.reviewMapClick(event))return;if(!pickTarget)return;invalidateRoute();const point=[event.latlng.lng,event.latlng.lat];if(pickTarget==='start')routeStart=point;else routeEnd=point;pickTarget=null;map.getContainer().style.cursor='';drawPoints();});
el('routeExample').onclick=()=>{invalidateRoute();routeStart=[105.8258961,21.0284767];routeEnd=[105.8413331,21.0160965];pickTarget=null;map.getContainer().style.cursor='';drawPoints();map.fitBounds([[routeStart[1],routeStart[0]],[routeEnd[1],routeEnd[0]]],{padding:[30,30],maxZoom:15});el('routeStatus').textContent='Đã nạp hai node mẫu từ graph khảo sát. Với ô tô/xe máy, cần chủ động bật chế độ chẩn đoán để thử.';};
el('floodExample').onclick=()=>{invalidateRoute();routeStart=floodTestPair?floodTestPair.start:[105.813533,20.998173];routeEnd=floodTestPair?floodTestPair.end:[105.841535,21.005882];pickTarget=null;map.getContainer().style.cursor='';drawPoints();if(floodTestPair){el('startRoad').add(new Option('Đoạn đi mẫu',floodTestPair.start_edge,true,true));el('endRoad').add(new Option('Đoạn đến mẫu',floodTestPair.end_edge,true,true));}if(!el('avoidFlood').disabled)el('avoidFlood').checked=true;map.fitBounds([[routeStart[1],routeStart[0]],[routeEnd[1],routeEnd[0]]],{padding:[30,30],maxZoom:floodTestPair?18:15});el('routeStatus').textContent=(floodTestPair?'Cặp điểm liền trước/sau đoạn bị chặn. ':'Cặp điểm kiểm thử Nguyễn Trãi → Giải Phóng. ')+ ' Chỉ có tác dụng minh họa ngập khi nạp tệp synthetic. Với ô tô/xe máy, chủ động bật diagnostic nếu thiếu coverage.';};
el('diagnostic').onchange=invalidateRoute;el('avoidFlood').onchange=invalidateRoute;
el('routeGo').onclick=async()=>{invalidateRoute();if(!routeStart||!routeEnd){el('routeStatus').textContent='Cần chọn đủ điểm đi và điểm đến.';return;}
 const request=++routeSeq,button=el('routeGo');button.disabled=true;el('routeStatus').textContent='Đang tính, tối đa 15 giây tìm kiếm...';
 try{const query=new URLSearchParams({profile:el('profile').value,weight:el('weight').value,mode:el('diagnostic').checked?'diagnostic':'strict',start:routeStart.join(','),end:routeEnd.join(','),max_snap:'100',avoid_flood:el('avoidFlood').checked?'true':'false'});if(el('startRoad').value)query.set('start_edge',el('startRoad').value);if(el('endRoad').value)query.set('end_edge',el('endRoad').value);const result=await get('/api/route?'+query);if(request!==routeSeq)return;
 showAttachments(result);
 if(result.baseline?.route)L.geoJSON(result.baseline.route,{style:{color:'#64748b',weight:5,dashArray:'8 6',opacity:.8}}).addTo(routeLayer);

 const labels={endpoint_blocked_by_flood:'Đoạn đường tại điểm đi/đến bị vùng ngập chặn. Không tự chuyển điểm sang đường khác.',same_attachment:'Hai điểm nối vào cùng vị trí trên đường.',coverage_incomplete:'Chế độ nghiêm ngặt bị khóa do thiếu coverage. Muốn thử thuật toán, chủ động bật chế độ chẩn đoán.',snap_not_found:'Không có đoạn đường đủ điều kiện trong 100m ở một hoặc hai điểm. Chọn lại gần mạng đường.',same_snapped_node:'Hai điểm nối vào cùng vị trí; chưa có tuyến giữa hai vị trí yêu cầu.',no_route:'Không tìm được tuyến giữa hai vị trí đã nối theo quy tắc mô hình.',search_limit:'Đã chạm giới hạn tìm kiếm; chưa kết luận không có đường.'};
 if(result.state!=='found'){el('routeStatus').textContent=labels[result.state]||result.state;el('detail').textContent=JSON.stringify(result,null,2);return;}
 const line=L.geoJSON(result.route,{style:{color:result.mode==='diagnostic'?'#c16b12':'#1768a8',weight:7,opacity:.95}}).addTo(routeLayer);map.fitBounds(line.getBounds(),{padding:[30,30],maxZoom:17});
 for(const snap of [result.snapped_start,result.snapped_end])L.circleMarker([snap.position[1],snap.position[0]],{radius:4,color:'#fff',weight:1,fillColor:'#111827',fillOpacity:1}).addTo(snapLayer);
 el('routeStatus').textContent=(result.mode==='diagnostic'?'TUYẾN CHẨN ĐOÁN — chưa đủ coverage. ':'Tuyến theo bộ quy tắc mô hình. ')+(result.length_m/1000).toFixed(2)+' km · '+(result.base_time_seconds===null?'chưa có thời gian':(result.base_time_seconds/60).toFixed(1)+' phút cơ sở')+'. Độ lệch nối đường: '+result.snapped_start.offset_m.toFixed(1)+'m / '+result.snapped_end.offset_m.toFixed(1)+'m. '+(result.flood_overlay?'Đã tránh vùng ngập đã nạp ('+result.flood_overlay.data_mode+'). ':'Chưa xét ngập. ')+'Chưa xét giao thông và lối tiếp cận từ điểm yêu cầu.';el('detail').textContent=JSON.stringify(result,null,2);
 }catch(e){if(request===routeSeq)el('routeStatus').textContent=e.message;}finally{button.disabled=false;}};

function showAttachments(result){
 for(const [id,key] of [['startRoad','start_candidates'],['endRoad','end_candidates']]){
  const select=el(id),previous=select.value;select.replaceChildren(new Option('Tự chọn đoạn gần nhất',''));
  for(const c of result[key]||[])select.add(new Option((c.name||'Đường không tên')+' · '+c.highway+' · way '+c.way_id+' · '+c.offset_m.toFixed(1)+'m',c.edge_id));
  if([...select.options].some(o=>o.value===previous))select.value=previous;
 }
 const describe=(s)=>s?(s.name||'Đường không tên')+' (way '+s.way_id+'), lệch '+s.offset_m.toFixed(1)+'m':'chưa nối';
 el('attachmentInfo').textContent='Đi: '+describe(result.snapped_start)+' · Đến: '+describe(result.snapped_end)+'. Nếu sai đường, chọn lại trong danh sách và tính lại. Không tự đổi sang đường xa hơn để có tuyến.';
 snapLayer.clearLayers();for(const snap of [result.snapped_start,result.snapped_end])if(snap)L.circleMarker([snap.position[1],snap.position[0]],{radius:4,color:'#fff',weight:1,fillColor:'#111827',fillOpacity:1}).addTo(snapLayer);
}
for(const id of ['startRoad','endRoad'])el(id).onchange=invalidateRoute;
refreshInfo();
