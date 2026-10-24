"""EVN INFO – add-on Home Assistant lấy dữ liệu điện từ CSKH EVN miền Trung (cskh-api.cpc.vn).

- Đăng nhập OAuth (password grant, giống integration nestup_evn – Apache 2.0), tự đăng nhập lại khi hết hạn.
- Định kỳ: sản lượng theo ngày (API chỉ trả ~35 ngày gần nhất → tự lưu lịch sử vào SQLite), hóa đơn theo tháng
  (tra cứu HĐĐT, có từ nhiều năm trước), tiền nợ / chỉ số hiện tại, lịch cắt điện của trạm.
- Lần đầu: nhập lịch sử từ CSDL add-on EVN VN cũ (/config/evnvn/evndata.db) nếu có.
- Đẩy sensor vào HA (Supervisor → Core API) và phục vụ JSON qua ingress (cùng định dạng add-on EVN VN cũ cho tab Điện EVN).
Chỉ dùng thư viện chuẩn Python.
"""
import base64, json, os, re, sqlite3, threading, time, traceback, urllib.error, urllib.parse, urllib.request
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

OPTS = json.load(open(os.environ.get('OPTIONS', '/data/options.json')))
DB_PATH = os.environ.get('DB_PATH', '/data/evninfo.db')
OLD_DB = os.environ.get('OLD_DB', '/haconfig/evnvn/evndata.db')
SUP = os.environ.get('SUPERVISOR_TOKEN')
CORE = os.environ.get('CORE_API', 'http://supervisor/core/api')
PORT = int(os.environ.get('PORT', 8099))
ALLOW = os.environ.get('ALLOW_IPS', '172.30.32.2,127.0.0.1').split(',')
API = 'https://cskh-api.cpc.vn'
APP = 'https://appcskh.cpc.vn:4433/api/v4/customer/home/'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
STATE = {'last_ok': None, 'last_err': None, 'running': False, 'next': None}
LOCK = threading.Lock()
WAKE = threading.Event()


def log(*a):
    print(datetime.now().strftime('%Y-%m-%d %H:%M:%S'), *a, flush=True)


# ------------------------------------------------------------------ CSDL
def db():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with db() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS accounts (code TEXT PRIMARY KEY, name TEXT, org TEXT, meter_point TEXT, station TEXT, station_name TEXT, meter_no TEXT, updated TEXT);
        CREATE TABLE IF NOT EXISTS daily (code TEXT, day TEXT, kwh REAL, reading REAL, read_at TEXT, src TEXT, PRIMARY KEY (code, day));
        CREATE TABLE IF NOT EXISTS bills (code TEXT, year INTEGER, month INTEGER, kwh REAL, amount REAL, vat REAL, total REAL, bill_id TEXT, issued TEXT, kind TEXT, src TEXT, PRIMARY KEY (code, year, month));
        CREATE TABLE IF NOT EXISTS outages (code TEXT, start TEXT, end TEXT, reason TEXT, station TEXT, type TEXT, status TEXT, PRIMARY KEY (code, start, station));
        CREATE TABLE IF NOT EXISTS info (code TEXT, key TEXT, value TEXT, PRIMARY KEY (code, key));
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        ''')


def meta(key, value=None):
    with db() as c:
        if value is None:
            r = c.execute('SELECT value FROM meta WHERE key=?', (key,)).fetchone()
            return r[0] if r else None
        c.execute('INSERT OR REPLACE INTO meta VALUES (?,?)', (key, str(value)))


def num(s):
    """'3.107,48' / '3107.48' / '307.800 đ' / 5.06 → float (None nếu không đọc được)."""
    if s is None: return None
    if isinstance(s, (int, float)): return float(s)
    t = re.sub(r'[^\d,.\-]', '', str(s))
    if not t or not re.search(r'\d', t): return None
    if ',' in t and '.' in t: t = t.replace('.', '').replace(',', '.')          # kiểu VN: 3.107,48
    elif ',' in t: t = t.replace(',', '.')
    elif re.fullmatch(r'-?\d{1,3}(\.\d{3})+', t): t = t.replace('.', '')         # 307.800 = 307800
    try: return float(t)
    except ValueError: return None


def import_old():
    """Nhập lịch sử từ CSDL add-on EVN VN cũ (một lần). Không ghi đè số liệu đã có."""
    if not OPTS.get('import_evnvn', True) or meta('imported_evnvn') or not os.path.exists(OLD_DB):
        return
    src = sqlite3.connect(f'file:{OLD_DB}?mode=ro', uri=True)
    n = {'daily': 0, 'bills': 0, 'outages': 0}
    with db() as c:
        for code, ngay, chi_so, kwh in src.execute('SELECT userevn, ngay, chi_so, dien_tieu_thu_kwh FROM daily_consumption'):
            try: d = datetime.strptime(ngay, '%d-%m-%Y').date().isoformat()
            except ValueError: continue
            n['daily'] += c.execute('INSERT OR IGNORE INTO daily (code, day, kwh, reading, src) VALUES (?,?,?,?,?)', (code, d, num(kwh), num(chi_so), 'evnvn')).rowcount
        for code, thang, nam, tien, kwh in src.execute('SELECT userevn, thang, nam, tien_dien, san_luong_kwh FROM monthly_bill'):
            n['bills'] += c.execute('INSERT OR IGNORE INTO bills (code, year, month, kwh, total, src) VALUES (?,?,?,?,?,?)', (code, nam, thang, num(kwh), num(tien), 'evnvn')).rowcount
        for code, d1, d2, t1, t2, why, area in src.execute('SELECT userevn, ngay_bat_dau, ngay_ket_thuc, thoi_gian_bat_dau, thoi_gian_ket_thuc, ly_do, khu_vuc FROM power_outage_schedule'):
            try:
                a = datetime.strptime(f'{d1} {t1}', '%d-%m-%Y %H:%M').isoformat(timespec='minutes')
                b = datetime.strptime(f'{d2} {t2}', '%d-%m-%Y %H:%M').isoformat(timespec='minutes')
            except ValueError: continue
            n['outages'] += c.execute('INSERT OR IGNORE INTO outages VALUES (?,?,?,?,?,?,?)', (code, a, b, why, area, '', '')).rowcount
    src.close()
    meta('imported_evnvn', datetime.now().isoformat(timespec='seconds'))
    log('Đã nhập lịch sử từ add-on EVN VN cũ:', n)


# ------------------------------------------------------------------ API EVN CPC
class CPC:
    def __init__(self, user, pw):
        self.user, self.pw, self.token, self.exp = user, pw, None, 0

    def _req(self, url, data=None, headers=None, retry=True):
        h = {'User-Agent': UA, 'Accept': 'application/json'}
        if self.token and 'Authorization' not in (headers or {}): h['Authorization'] = 'Bearer ' + self.token
        h.update(headers or {})
        for i in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=40) as f:
                    return f.status, f.read()
            except urllib.error.HTTPError as e:
                if e.code == 401 and retry and data is None:
                    self.login(); h['Authorization'] = 'Bearer ' + self.token; retry = False; continue
                return e.code, e.read()
            except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
                if i == 2: raise
                time.sleep(5 * (i + 1))
        return 0, b''

    def login(self):
        basic = base64.b64encode(b'CSKH_Swagger:1q2w3e*').decode()   # client công khai của trang CSKH (theo nestup_evn)
        body = urllib.parse.urlencode({'username': self.user, 'password': self.pw, 'scope': 'CSKH', 'grant_type': 'password'}).encode()
        self.token = None
        st, b = self._req(API + '/connect/token', body, {'Authorization': 'Basic ' + basic, 'Content-Type': 'application/x-www-form-urlencoded'}, retry=False)
        j = json.loads(b or b'{}')
        if st != 200 or 'access_token' not in j:
            raise RuntimeError(f'Đăng nhập EVN CPC thất bại ({st}): {j.get("error_description") or j.get("error") or "không rõ"}')
        self.token, self.exp = j['access_token'], time.time() + int(j.get('expires_in', 3600)) - 120

    def get(self, path):
        if not self.token or time.time() > self.exp: self.login()
        st, b = self._req(path if path.startswith('http') else API + path)
        if st != 200: raise RuntimeError(f'{path.split("?")[0]} → {st} {b[:160].decode("utf-8", "replace")}')
        return json.loads(b)


def fmt(d):   # API dùng MM-dd-yyyy HH:mm:ss
    return urllib.parse.quote(d.strftime('%m-%d-%Y 00:00:00'))


def fetch_account(api, c, code, name):
    inf = api.get(f'/api/remote/customers/{code}/info')
    mp = (inf.get('customerMeterPoints') or [{}])[0]
    org, point = inf.get('orgCode') or code[:6], mp.get('customerMeterCode') or code + '001'
    station = mp.get('stationCode') or inf.get('stationCode') or ''
    c.execute('INSERT OR REPLACE INTO accounts VALUES (?,?,?,?,?,?,?,?)', (code, name or inf.get('customerName'), org, point, station, mp.get('stationName') or '', inf.get('meterId') or mp.get('meterId') or '', datetime.now().isoformat(timespec='seconds')))

    # sản lượng theo ngày: API chỉ cho ~35 ngày gần nhất, tối đa 31 ngày / lần
    today = date.today()
    for a, b in [(today - timedelta(days=30), today), (today - timedelta(days=34), today - timedelta(days=31))]:
        try: rows = api.get(f'/api/remote/meter/rf/sl-tieu-thu-view?customerCode={code}&maDiemDo={point}&orgCode={org}&fromDate={fmt(a)}&toDate={fmt(b)}')
        except RuntimeError as e: log(code, 'sản lượng ngày', a, b, e); continue
        for r in rows if isinstance(rows, list) else []:
            d = (r.get('ngay') or '')[:10]
            if not d: continue
            m = (r.get('chiSoCongTo') or [{}])[0]
            kwh = r.get('sanLuongNgay')
            # ngày hôm nay chưa chốt: lưu chỉ số, sản lượng để None nếu = 0 và chưa có chỉ số mới trong ngày
            if d == today.isoformat() and not kwh: kwh = None
            c.execute('''INSERT INTO daily (code, day, kwh, reading, read_at, src) VALUES (?,?,?,?,?,'cpc')
                         ON CONFLICT(code, day) DO UPDATE SET kwh=COALESCE(excluded.kwh, daily.kwh), reading=COALESCE(excluded.reading, daily.reading), read_at=excluded.read_at, src='cpc' ''',
                      (code, d, kwh, num(m.get('chiSoMoiNhat')), m.get('thoiDiemMoiNhat')))

    # hóa đơn theo tháng (HĐĐT). Lần đầu lấy bill_years năm, sau đó 3 tháng gần nhất + tháng chưa có
    years = int(OPTS.get('bill_years', 3))
    have = {(r[0], r[1]) for r in c.execute("SELECT year, month FROM bills WHERE code=? AND src='cpc'", (code,))}
    y, m = today.year, today.month
    for i in range(years * 12):
        if (y, m) not in have or i < 3:
            try: res = api.get(f'/api/remote/traCuuHDDTTheoMKH/{code}/1/{m}/{y}').get('result') or []
            except RuntimeError as e: log(code, f'hóa đơn {m}/{y}', e); res = []
            tien = [x for x in res if 'Tiền điện' in str(x.get('LOAI_HDON') or x.get('LOAI_HOA_DON') or '')] or res
            if tien:
                kwh = sum(num(x.get('DIEN_TTHU')) or 0 for x in tien)
                tot = sum(num(x.get('TONG_TIEN')) or 0 for x in tien)
                amt = sum(num(x.get('SO_TIEN')) or 0 for x in tien)
                vat = sum(num(x.get('TIEN_GTGT')) or 0 for x in tien)
                x = tien[-1]
                c.execute('INSERT OR REPLACE INTO bills VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                          (code, y, m, kwh, amt, vat, tot, str(x.get('ID_HDON') or ''), (x.get('NGAY_PHANH') or '')[:10], x.get('LOAI_HOA_DON') or '', 'cpc'))
            time.sleep(0.3)
        m -= 1
        if m == 0: m, y = 12, y - 1

    # tiền nợ, chỉ số hiện tại, kỳ hóa đơn gần nhất
    try:
        h = api.get(APP + code).get('response') or {}
        cur = h.get('dienNangHienTai') or {}
        paid = (h.get('tinhTrangThanhToan') or '').strip()
        kv = {'ky_hoa_don': h.get('kyHoaDon'), 'tien_hoa_don': num(h.get('tienHoaDon')), 'tinh_trang': paid,
              'tien_no': 0 if paid == 'Đã thanh toán' else (num(h.get('tienHoaDon')) or 0),
              'chi_so': num(cur.get('chiSo')), 'san_luong_ky': num(cur.get('sanLuong')), 'thoi_diem': cur.get('thoiDiem')}
        for k, v in kv.items(): c.execute('INSERT OR REPLACE INTO info VALUES (?,?,?)', (code, k, None if v is None else str(v)))
    except Exception as e: log(code, 'trang chủ khách hàng', e)
    try:
        a = api.get(f'/api/cskh/power-consumption-alerts/by-customer-code/{code}').get('electricConsumption') or {}
        for k, v in {'hom_nay': a.get('electricConsumptionToday'), 'hom_qua': a.get('electricConsumptionYesterday'),
                     'thang_nay': a.get('electricConsumptionThisMonth'), 'thang_truoc': a.get('electricConsumptionLastMonth')}.items():
            c.execute('INSERT OR REPLACE INTO info VALUES (?,?,?)', (code, k, None if v is None else str(v)))
    except Exception as e: log(code, 'cảnh báo tiêu thụ', e)

    # lịch cắt điện của trạm khách hàng: 7 ngày trước → 30 ngày tới
    if station:
        try:
            o = api.get(f'/api/remote/outages/area?orgCode={org[:4]}&subOrgCode={org}&stationCode={station}&fromDate={fmt(today - timedelta(days=7))}&toDate={fmt(today + timedelta(days=30))}')
            for it in o.get('items') or []:
                c.execute('INSERT OR REPLACE INTO outages VALUES (?,?,?,?,?,?,?)', (code, it['fromDate'][:16], (it.get('toDate') or '')[:16], it.get('reason') or '',
                          it.get('stationName') or it.get('stationCode') or '', it.get('outageType') or '', it.get('statusStr') or it.get('status') or ''))
        except Exception as e: log(code, 'lịch cắt điện', e)


def run_once():
    with LOCK:
        STATE['running'] = True
        try:
            api = CPC(OPTS['username'], OPTS['password'])
            api.login()
            custs = api.get('/api/remote/customers/infos').get('customerCodes') or []
            if not custs: raise RuntimeError('Tài khoản không có mã khách hàng nào')
            for cu in custs:
                with db() as c: fetch_account(api, c, cu['customerCode'], cu.get('customerName'))
            STATE['last_ok'], STATE['last_err'] = datetime.now().astimezone().isoformat(timespec='seconds'), None
            log('Cập nhật xong', len(custs), 'mã khách hàng')
        except Exception as e:
            STATE['last_err'] = f'{datetime.now().isoformat(timespec="seconds")} {e}'.replace(OPTS.get('password') or '\0', '***')
            log('LỖI', e); traceback.print_exc()
        finally:
            STATE['running'] = False
    if OPTS.get('sensors', True): push_sensors()


# ------------------------------------------------------------------ sensor HA
def push_sensors():
    if not SUP: return
    def put(eid, state, attrs):
        body = json.dumps({'state': state, 'attributes': attrs}).encode()
        r = urllib.request.Request(f'{CORE}/states/{eid}', data=body, method='POST', headers={'Authorization': 'Bearer ' + SUP, 'Content-Type': 'application/json'})
        try: urllib.request.urlopen(r, timeout=15).read()
        except Exception as e: log('sensor', eid, e)
    with db() as c:
        for a in c.execute('SELECT * FROM accounts').fetchall():
            code = a['code']; p = 'sensor.evn_' + code.lower(); nm = f'EVN {code[-4:]}'
            inf = {r['key']: r['value'] for r in c.execute('SELECT key, value FROM info WHERE code=?', (code,))}
            last = c.execute('SELECT day, kwh, reading FROM daily WHERE code=? AND kwh IS NOT NULL AND day < ? ORDER BY day DESC LIMIT 1', (code, date.today().isoformat())).fetchone()   # ngày đã chốt
            bill = c.execute('SELECT * FROM bills WHERE code=? AND total IS NOT NULL ORDER BY year DESC, month DESC LIMIT 1', (code,)).fetchone()
            ym = date.today().strftime('%Y-%m')
            month = c.execute("SELECT SUM(kwh) FROM daily WHERE code=? AND substr(day,1,7)=?", (code, ym)).fetchone()[0]
            nxt = c.execute("SELECT * FROM outages WHERE code=? AND end >= ? ORDER BY start LIMIT 5", (code, datetime.now().isoformat(timespec='minutes'))).fetchall()
            base = {'customer_code': code, 'customer_name': a['name'], 'attribution': 'CSKH EVN miền Trung'}
            E = lambda n, extra=None: {**base, 'unit_of_measurement': 'kWh', 'device_class': 'energy', 'friendly_name': f'{nm} {n}', 'icon': 'mdi:flash', **(extra or {})}
            M = lambda n, extra=None: {**base, 'unit_of_measurement': 'VND', 'device_class': 'monetary', 'friendly_name': f'{nm} {n}', 'icon': 'mdi:cash', **(extra or {})}
            if inf.get('chi_so'): put(p + '_chi_so', inf['chi_so'], E('Chỉ số công tơ', {'state_class': 'total_increasing', 'read_at': inf.get('thoi_diem')}))
            if last: put(p + '_ngay_gan_nhat', round(last['kwh'], 2), E('Sản lượng ngày gần nhất', {'state_class': 'measurement', 'day': last['day']}))
            if inf.get('hom_qua') is not None: put(p + '_hom_qua', inf['hom_qua'], E('Sản lượng hôm qua', {'state_class': 'measurement'}))
            if inf.get('thang_nay') is not None or month is not None:
                put(p + '_thang_nay', inf.get('thang_nay') or round(month or 0, 2), E('Sản lượng tháng này', {'state_class': 'total', 'sum_daily': round(month or 0, 2)}))
            if inf.get('san_luong_ky') is not None: put(p + '_ky_nay', inf['san_luong_ky'], E('Sản lượng kỳ này (tạm tính)', {'state_class': 'total'}))
            if bill: put(p + '_hoa_don', bill['total'], M('Hóa đơn gần nhất', {'month': f"{bill['month']}/{bill['year']}", 'kwh': bill['kwh'], 'issued': bill['issued'], 'vat': bill['vat']}))
            if inf.get('tien_no') is not None: put(p + '_tien_no', inf['tien_no'], M('Tiền nợ', {'payment_status': inf.get('tinh_trang'), 'bill_period': inf.get('ky_hoa_don')}))
            put(p + '_cat_dien', nxt[0]['start'] if nxt else 'Không có', {**base, 'friendly_name': f'{nm} Lịch cắt điện', 'icon': 'mdi:power-plug-off',
                'schedule': [dict(start=o['start'], end=o['end'], reason=o['reason'], station=o['station'], type=o['type']) for o in nxt]})
            put(p + '_cap_nhat', STATE['last_ok'] or 'unknown', {**base, 'friendly_name': f'{nm} Lần cập nhật', 'device_class': 'timestamp' if STATE['last_ok'] else None,
                'icon': 'mdi:update', 'last_error': STATE['last_err']})


# ------------------------------------------------------------------ web (ingress)
def compat_month(code, y):
    with db() as c:
        rows = c.execute('SELECT month, kwh, total FROM bills WHERE code=? AND year=? ORDER BY month', (code, y)).fetchall()
    if not rows: return None
    return {'SanLuong': [{'Tháng': r['month'], 'Điện tiêu thụ (KWh)': '' if r['kwh'] is None else f"{r['kwh']:g}"} for r in rows],
            'TienDien': [{'Tháng': r['month'], 'Tiền Điện': '' if r['total'] is None else f"{r['total']:.0f}"} for r in rows]}


def compat_daily(code):
    with db() as c:
        rows = c.execute('SELECT day, kwh, reading FROM daily WHERE code=? ORDER BY day', (code,)).fetchall()
    return [{'Ngày': datetime.strptime(r['day'], '%Y-%m-%d').strftime('%d-%m-%Y'), 'Điện tiêu thụ (kWh)': '' if r['kwh'] is None else f"{r['kwh']:g}",
             'Chỉ số': 'Không có dữ liệu' if r['reading'] is None else f"{r['reading']:g}"} for r in rows]


def summary():
    with db() as c:
        accs = []
        for a in c.execute('SELECT code, name, station_name FROM accounts ORDER BY code').fetchall():
            code = a['code']
            accs.append({'code': code, 'name': a['name'], 'station': a['station_name'],
                         'info': {r['key']: r['value'] for r in c.execute('SELECT key, value FROM info WHERE code=?', (code,))},
                         'days': [dict(r) for r in c.execute('SELECT day, kwh, reading FROM daily WHERE code=? ORDER BY day DESC LIMIT 14', (code,))],
                         'bills': [dict(r) for r in c.execute('SELECT year, month, kwh, total, issued FROM bills WHERE code=? ORDER BY year DESC, month DESC LIMIT 24', (code,))],
                         'outages': [dict(r) for r in c.execute('SELECT start, end, reason, station, type FROM outages WHERE code=? ORDER BY start DESC LIMIT 10', (code,))],
                         'count': {'daily': c.execute('SELECT COUNT(*) FROM daily WHERE code=?', (code,)).fetchone()[0],
                                   'bills': c.execute('SELECT COUNT(*) FROM bills WHERE code=?', (code,)).fetchone()[0]}})
    return {'state': STATE, 'accounts': accs}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        b = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)

    def _ok(self):
        if self.client_address[0] in ALLOW: return True
        self._send(403, {'error': 'forbidden'}); return False

    def do_GET(self):
        if not self._ok(): return
        p = urllib.parse.urlparse(self.path).path.lstrip('/')
        if p in ('', 'index.html'):
            return self._send(200, open(os.path.join(os.path.dirname(__file__), 'index.html'), 'rb').read(), 'text/html; charset=utf-8')
        if p == 'accounts.json':
            with db() as c: return self._send(200, [dict(r) for r in c.execute('SELECT code, name, station_name FROM accounts ORDER BY code')])
        if p == 'summary.json': return self._send(200, summary())
        m = re.fullmatch(r'tien_dien_san_luong_(\d{4})_([A-Z0-9]+)\.json', p)
        if m:
            d = compat_month(m[2], int(m[1]))
            return self._send(200, d) if d else self._send(404, {'error': 'no data'})
        m = re.fullmatch(r'dien_tieu_thu_([A-Z0-9]+)\.json', p)
        if m: return self._send(200, compat_daily(m[1]))
        self._send(404, {'error': 'not found'})

    def do_POST(self):
        if not self._ok(): return
        if urllib.parse.urlparse(self.path).path.lstrip('/') == 'refresh':
            WAKE.set(); return self._send(202, {'ok': True})
        self._send(404, {'error': 'not found'})


def loop():
    while True:
        run_once()
        wait = int(OPTS.get('interval_minutes', 180)) * 60
        STATE['next'] = (datetime.now() + timedelta(seconds=wait)).isoformat(timespec='seconds')
        WAKE.wait(wait); WAKE.clear()


if __name__ == '__main__':
    if not OPTS.get('username') or not OPTS.get('password'):
        log('Chưa cấu hình username / password – vào tab Cấu hình của add-on.')
    init_db()
    try: import_old()
    except Exception as e: log('Nhập lịch sử cũ lỗi:', e)
    if OPTS.get('username') and OPTS.get('password'):
        threading.Thread(target=loop, daemon=True).start()
    log('Web (ingress) ở cổng', PORT)
    ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()
