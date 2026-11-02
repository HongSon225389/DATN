"""Per-request directed edge attachment; source graph remains immutable."""
import math
from experimental_router import Router, coordinate, distance

def project(point,a,b):
    scale=math.cos(math.radians(point[1]));dx=(b[0]-a[0])*scale;dy=b[1]-a[1]
    den=dx*dx+dy*dy
    t=0 if den==0 else max(0,min(1,((point[0]-a[0])*scale*dx+(point[1]-a[1])*dy)/den))
    pos=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]
    return t,pos,distance(point,pos)

def candidates(router,point,weight,max_m):
    coordinate(point);groups={}
    for eid,e in sorted(router.edges.items()):
        if weight=='time' and e['base_time_seconds'] is None:continue
        ns=router.g['nodes'];a=ns[e['graph_from']];b=ns[e['graph_to']]
        t,pos,offset=project(point,[a['lon'],a['lat']],[b['lon'],b['lat']])
        if offset>max_m:continue
        if (t<1e-9 and (a.get('terminal_port') or not a.get('snap_eligible',False))) or (t>1-1e-9 and (b.get('terminal_port') or not b.get('snap_eligible',False))):continue
        key=(e['way_id'],e['segment_index'])
        if key not in groups:
            groups[key]={'edge_id':eid,'way_id':e['way_id'],'segment_index':e['segment_index'],'name':e.get('name',''),'highway':e.get('highway',''),'position':pos,'offset_m':offset,'directions':[]}
        groups[key]['directions'].append(eid)
    return sorted(groups.values(),key=lambda x:(x['offset_m'],x['edge_id']))

def route_edges(router,start,end,weight='distance',mode='strict',max_snap_m=100,max_states=150000,max_seconds=15,start_edge=None,end_edge=None,blocked_edge_ids=None):
    # Delegate validation and coverage semantics to the established search.
    if mode not in {'strict','diagnostic'} or weight not in {'distance','time'} or not 0<max_snap_m<=500:raise ValueError('Chế độ/trọng số/giới hạn nối không hợp lệ')
    coordinate(start);coordinate(end)
    if mode=='strict' and not router.g['strict_coverage_complete']:
        return router.route(start,end,weight,mode,max_snap_m,max_states,max_seconds)
    ca=candidates(router,start,weight,max_snap_m);cb=candidates(router,end,weight,max_snap_m)
    def choose(cs,selected):
        if selected:
            for c in cs:
                if selected in c['directions']:return c
            raise ValueError('Đoạn đường đã chọn không hợp lệ trong bán kính nối')
        return cs[0] if cs else None
    a,b=choose(ca,start_edge),choose(cb,end_edge)
    if a is None or b is None:
        return {'state':'snap_not_found','route':None,'attachment_method':'edge_projection','start_candidates':ca[:8],'end_candidates':cb[:8]}
    blocked=set(blocked_edge_ids or [])
    for role,c in [('start',a),('end',b)]:
        selected=router.edges[c['edge_id']];ns=router.g['nodes'];na=ns[selected['graph_from']];nb=ns[selected['graph_to']]
        fraction=project(c['position'],[na['lon'],na['lat']],[nb['lon'],nb['lat']])[0]
        if blocked.intersection(c['directions']) and 1e-9<fraction<1-1e-9:
            return {'state':'endpoint_blocked_by_flood','blocked_endpoint':role,'route':None,'attachment_method':'edge_projection','snapped_start':a,'snapped_end':b,'start_candidates':ca[:8],'end_candidates':cb[:8]}
    g={**router.g,'nodes':dict(router.g['nodes']),'edges':{eid:e for eid,e in router.edges.items() if eid not in blocked}};partials={}
    def attach(c,point,role):
        e=router.edges[c['edge_id']];na=g['nodes'][e['graph_from']];nb=g['nodes'][e['graph_to']]
        t,pos,offset=project(point,[na['lon'],na['lat']],[nb['lon'],nb['lat']])
        gid=e['graph_from'] if t<1e-9 else e['graph_to'] if t>1-1e-9 else '@'+role
        if gid.startswith('@'):g['nodes'][gid]={'osm_node_id':None,'lon':pos[0],'lat':pos[1],'snap_eligible':True,'terminal_port':False}
        return {**c,'graph_node':gid,'osm_node_id':g['nodes'][gid]['osm_node_id'],'fraction':t}
    a=attach(a,start,'start');b=attach(b,end,'end')
    def part(eid,lo,hi,src,dst,label):
        if hi-lo<=1e-9 or eid in blocked:return
        e=router.edges[eid];pid='@'+label+':'+eid
        g['edges'][pid]={**e,'edge_id':pid,'graph_from':src,'graph_to':dst,'length_m':e['length_m']*(hi-lo),'base_time_seconds':None if e['base_time_seconds'] is None else e['base_time_seconds']*(hi-lo)}
        partials[pid]={'source_edge_id':eid,'from_fraction':lo,'to_fraction':hi}
    for c,point,role in [(a,start,'start'),(b,end,'end')]:
        if not c['graph_node'].startswith('@'):continue
        for eid in c['directions']:
            e=router.edges[eid];na=g['nodes'][e['graph_from']];nb=g['nodes'][e['graph_to']]
            t,_,_=project(point,[na['lon'],na['lat']],[nb['lon'],nb['lat']])
            if role=='start':part(eid,t,1,c['graph_node'],e['graph_to'],'start')
            else:part(eid,0,t,e['graph_from'],c['graph_node'],'end')
    if (a['way_id'],a['segment_index'])==(b['way_id'],b['segment_index']) and a['graph_node']!=b['graph_node']:
        for eid in set(a['directions'])&set(b['directions']):
            e=router.edges[eid];na=g['nodes'][e['graph_from']];nb=g['nodes'][e['graph_to']];pa=[na['lon'],na['lat']];pb=[nb['lon'],nb['lat']]
            lo=project(a['position'],pa,pb)[0];hi=project(b['position'],pa,pb)[0]
            part(eid,lo,hi,a['graph_node'],b['graph_node'],'direct')
    if distance(a['position'],b['position'])<0.001 and (a['way_id'],a['segment_index'])==(b['way_id'],b['segment_index']):b['graph_node']=a['graph_node']
    local=Router(g)
    local.snap=lambda point,role,weight,max_m: a if role=='start' else b
    r=local.route(start,end,weight,mode,max_snap_m,max_states,max_seconds)
    r['attachment_method']='edge_projection';r['start_candidates']=ca[:8];r['end_candidates']=cb[:8]
    r['partial_edges']={eid:partials[eid] for eid in r.get('edge_ids',[]) if eid in partials}
    r['warnings']=[w for w in r.get('warnings',[]) if not w.startswith(('Node snapping','Not shortest over'))]+['Nearest eligible segment projection; no automatic reachable-road fallback','Click-to-road access is unverified and excluded from route cost; inspect the selected road and side']
    if r['state']=='same_snapped_node':r['state']='same_attachment'
    return r
