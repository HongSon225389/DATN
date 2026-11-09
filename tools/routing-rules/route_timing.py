"""Schedule estimates on an already-computed FROZEN route, not temporal routing."""
from datetime import datetime, timedelta, timezone
import math

NOTICE = ('Lịch trình ước tính trên graph cố định; không đánh giá lại quy tắc hoặc '
          'ngập theo giờ yêu cầu/tới từng cạnh, không dự báo giao thông hoặc ngập.')

def parse_request(mode=None, value=None):
    if mode is None and value is None:return None
    if mode not in {'depart_at','arrive_by'} or not isinstance(value,str):
        raise ValueError('Cần chế độ depart_at/arrive_by và thời gian có múi giờ')
    try:at=datetime.fromisoformat(value.replace('Z','+00:00'))
    except (ValueError,TypeError):raise ValueError('Thời gian ISO không hợp lệ')
    if at.tzinfo is None or at.utcoffset() is None:raise ValueError('Thời gian phải có múi giờ')
    return mode,at

def estimate(result, request):
    if request is None:return result
    mode,at=request
    schedule={'method':'frozen_route_duration_estimate','request_mode':mode,
              'requested_at':at.isoformat(),'graph_evaluated_at':result.get('evaluated_at'),
              'time_dependent_routing':False,'notice':NOTICE,'state':'unavailable',
              'estimated_departure':None,'estimated_arrival':None}
    seconds=result.get('base_time_seconds')
    if result.get('state')=='found' and isinstance(seconds,(int,float)) and not isinstance(seconds,bool) and math.isfinite(seconds) and seconds>=0:
        instant=at.astimezone(timezone.utc)
        delta=timedelta(seconds=seconds)
        departure,arrival=(instant,instant+delta) if mode=='depart_at' else (instant-delta,instant)
        schedule.update(state='estimated',estimated_departure=departure.astimezone(at.tzinfo).isoformat(),
                        estimated_arrival=arrival.astimezone(at.tzinfo).isoformat(),base_time_seconds=seconds)
    return {**result,'schedule':schedule}
