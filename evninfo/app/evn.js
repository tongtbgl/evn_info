// Panel "Điện EVN": giao diện cho dữ liệu add-on EVN VN (smarthomeblack, cũ); hp-evncpc-panel: cùng giao diện cho add-on EVN INFO (homelab, đang thử) – hai add-on chạy song song.
// Dữ liệu đọc qua ingress của add-on (phiên ingress tạo bằng quyền HA của người dùng) – không sửa add-on, không cần token.
// Trong panel HA (smarthome.js): nút tải lại chỉ dựng lại tab này (panel chặn sự kiện hp-reload); bản web không ai chặn → tải lại trang
const hpReload = (el) => { if (el.dispatchEvent(new CustomEvent('hp-reload', { bubbles: true, composed: true, cancelable: true }))) location.reload(); };
const TIERS = [[50, 1984], [50, 2050], [100, 2380], [100, 2998], [100, 3350], [Infinity, 3460]];   // giá bậc thang (đ/kWh, chưa VAT) như add-on
const VAT = 0.08;

const CSS = `
:host{display:block;height:100%;--bg:#0b0f17;--card:#141b28;--card2:#182131;--line:#243046;--ink:#e8edf6;--mut:#8592a8;
  --blue:#38c6f4;--amber:#f5b83d;--green:#34d399;--red:#f87171;--violet:#8b93ff;--ghost:rgba(133,146,168,.28);
  font-family:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}
:host(.light){--bg:#eef2f7;--card:#fff;--card2:#f5f7fb;--line:#dde3ec;--ink:#162033;--mut:#66728a;--blue:#0a9fd6;--amber:#e09b12;--green:#0fa877;--red:#dc2626;--violet:#5b63e6;--ghost:rgba(102,114,138,.22)}
*{box-sizing:border-box}
.wrap{height:100vh;height:var(--hp-h,100dvh);overflow-y:auto;background:radial-gradient(1000px 500px at 10% -10%,rgba(56,198,244,.10),transparent 60%),radial-gradient(800px 400px at 100% 0,rgba(245,184,61,.08),transparent 60%),var(--bg)}
.bar{display:flex;align-items:center;gap:8px;height:48px;padding:0 6px;background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
.bar[hidden]{display:none}.bar button{width:40px;height:40px;border:0;border-radius:50%;background:none;color:var(--ink);display:grid;place-items:center}
.page{max-width:1280px;margin:0 auto;padding:18px 18px 40px;display:grid;gap:16px}
.page>*{min-width:0}
.ic{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
h1{margin:0;font-size:24px;font-weight:600;letter-spacing:-.02em}h2{margin:0;font-size:16px;font-weight:600}
.head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
.head p{margin:2px 0 0;color:var(--mut);font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px;min-width:0}
.ch{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.ch p{margin:2px 0 0;font-size:12.5px;color:var(--mut)}
.seg{display:flex;gap:4px;padding:4px;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow-x:auto;max-width:100%}
.seg button{border:0;background:none;border-radius:9px;padding:7px 14px;font:inherit;font-size:13.5px;color:var(--mut);white-space:nowrap;cursor:pointer;display:flex;align-items:center;gap:6px}
.seg button.on{background:var(--card2);color:var(--ink);font-weight:600}
.seg button .ed{opacity:.5;font-size:12px}
.filters{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.fl{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--mut)}
select,input[type=date]{font:inherit;font-size:13.5px;color:var(--ink);background:var(--card);border:1px solid var(--line);border-radius:10px;padding:7px 10px;color-scheme:dark}
:host(.light) select,:host(.light) input[type=date]{color-scheme:light}
.btn{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:10px;padding:7px 12px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.btn.on{border-color:var(--blue);color:var(--blue)}
.kpis{display:grid;grid-template-columns:1.4fr repeat(4,minmax(0,1fr));gap:12px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;display:grid;gap:6px;position:relative;overflow:hidden}
.kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--c,var(--blue))}
.kpi span{font-size:12.5px;color:var(--mut)}
.kpi b{font-size:26px;font-weight:700;letter-spacing:-.02em;line-height:1.1}
.kpi b small{font-size:13px;font-weight:500;color:var(--mut);margin-left:4px}
.kpi p{margin:0;font-size:12.5px;color:var(--mut)}
.kpi.now{--c:var(--amber);background:linear-gradient(150deg,color-mix(in srgb,var(--amber) 12%,var(--card)),var(--card))}
.kpi.now b{font-size:30px}
.prog{height:6px;border-radius:9px;background:var(--card2);overflow:hidden;margin-top:4px}.prog i{display:block;height:100%;background:var(--amber);border-radius:inherit}
.chart{position:relative;height:280px}.chart svg{width:100%;height:100%;display:block;overflow:visible}
.chart.sm{height:240px}
.ax{font-size:11px;fill:var(--mut)}.gl{stroke:var(--line);stroke-width:1}
.bk{fill:var(--blue);opacity:.85;cursor:pointer;transition:opacity .2s}.bk:hover{opacity:1}.bk.sel{fill:var(--amber);opacity:1}
.bg{fill:var(--ghost)}
.lc{fill:none;stroke:var(--amber);stroke-width:2.2}.dc{fill:var(--card);stroke:var(--amber);stroke-width:2}
.bd{fill:var(--blue);opacity:.8}.bd.max{fill:var(--red)}.bd.min{fill:var(--green)}
.legend{display:flex;gap:12px;flex-wrap:wrap;font-size:12.5px;color:var(--mut)}
.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
.two{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:16px;align-items:start}
.stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.stats div{background:var(--card2);border-radius:12px;padding:10px 12px;display:grid;gap:2px}
.stats span{font-size:12px;color:var(--mut)}.stats b{font-size:16px;font-weight:600}
.up{color:var(--red)}.down{color:var(--green)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th:first-child,td:first-child{text-align:left}
th{font-size:12px;color:var(--mut);font-weight:500;position:sticky;top:0;background:var(--card);cursor:pointer;user-select:none}
th.s::after{content:" ▾"}th.s.asc::after{content:" ▴"}
tfoot td{font-weight:600;border-bottom:0}
.tbl{max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:12px}
.tiers td:first-child{color:var(--mut)}
.presets{display:flex;gap:6px;flex-wrap:wrap}
.tip{position:fixed;z-index:20;pointer-events:none;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:9px 12px;font-size:12.5px;box-shadow:0 12px 30px -12px rgba(0,0,0,.5);min-width:140px}
.tip[hidden]{display:none}.tip b{display:block;margin-bottom:3px}.tip div{display:flex;justify-content:space-between;gap:14px}
.msg{padding:30px;text-align:center;color:var(--mut)}
.mut{color:var(--mut)}
.hbtns{display:flex;gap:8px;align-items:center;max-width:100%}
.rl{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);display:grid;place-items:center;cursor:pointer;flex:none}
.rl.spin .ic{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media (max-width:1100px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.kpi.now{grid-column:1/-1}.two{grid-template-columns:minmax(0,1fr)}}
@media (max-width:520px){.page{padding:14px 14px 32px}.kpi b{font-size:22px}.kpi.now b{font-size:26px}.chart{height:240px}}`;

const I = {
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>', bolt: '<path d="M13.5 2 5 13.2h5.6L9.8 22 19 10.4h-5.7z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
};
const ico = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;
const n0 = (v) => v == null || !isFinite(v) ? '–' : Math.round(v).toLocaleString('vi-VN');
const n1 = (v, d = 1) => v == null || !isFinite(v) ? '–' : Number(v).toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dvn = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
const dvnY = (d) => dvn(d) + '/' + d.getFullYear();
const DAY = 86400000;

// tiền điện theo bậc thang (+VAT 8%)
function bill(kwh) {
  let rest = Math.max(0, kwh || 0), sub = 0; const rows = [];
  for (let i = 0; i < TIERS.length && rest > 0; i++) { const k = Math.min(rest, TIERS[i][0]); rows.push({ tier: i + 1, kwh: k, price: TIERS[i][1], cost: k * TIERS[i][1] }); sub += k * TIERS[i][1]; rest -= k; }
  return { sub, vat: sub * VAT, total: Math.round(sub * (1 + VAT)), rows };
}

// Sáng/tối theo cùng cài đặt với tab Năng lượng (localStorage hp-theme); chưa chọn thì theo HA / trang web
const hpDark = (h) => { try { const t = localStorage.getItem('hp-theme'); if (t) return t !== 'light'; } catch (_) {} return !!(h && h.themes && h.themes.darkMode); };

class HpEvnPanel extends HTMLElement {
  static ADDON = ['996096a9_evnvn', 'EVN VN']; static TITLE = 'Điện EVN'; static KEY = 'hp-evn-';
  set hass(h) {
    const first = !this._hass; this._hass = h;
    if (!this._root) this._build();
    this.classList.toggle('light', !hpDark(h));
    if (first) this._init();
  }
  set narrow(n) { this._narrow = n; if (this._bar) this._bar.hidden = !n; }
  set panel(p) { this._panel = p; }
  disconnectedCallback() { clearInterval(this._keep); }

  _ls(k, d) { try { const v = localStorage.getItem(this.constructor.KEY + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } }
  _lsSet(k, v) { try { localStorage.setItem(this.constructor.KEY + k, JSON.stringify(v)); } catch (_) {} }

  _build() {
    this._root = this.attachShadow({ mode: 'open' });
    this._root.innerHTML = `<style>${CSS}</style>
    <div class="wrap"><div class="bar" ${this._narrow ? '' : 'hidden'}><button data-menu aria-label="Menu">${ico('menu')}</button><span>${this.constructor.TITLE}</span></div>
      <div class="page" data-k="page"><div class="msg">Đang tải dữ liệu EVN…</div></div></div>
    <div class="tip" hidden></div>`;
    this._bar = this._root.querySelector('.bar');
    this._tip = this._root.querySelector('.tip');
    this._root.querySelector('[data-menu]').addEventListener('click', () => this.dispatchEvent(new Event('hass-toggle-menu', { bubbles: true, composed: true })));
  }

  // ---- phiên ingress của add-on (giống cách HA mở panel add-on)
  async _ingress() {
    const ws = (endpoint, method = 'get', data) => this._hass.callWS({ type: 'supervisor/api', endpoint, method, ...(data ? { data } : {}) });
    const [slug, label] = this.constructor.ADDON; this._src = { slug, label };
    let info = null; try { info = await ws(`/addons/${slug}/info`); } catch (_) {}
    if (!info || info.state !== 'started') throw new Error(`Add-on ${label} chưa chạy`);
    this._base = (info.ingress_url || info.ingress_entry || '').replace(/\/$/, '');
    const s = await ws('/ingress/session', 'post');
    const set = (sess) => { document.cookie = `ingress_session=${sess};path=/api/hassio_ingress/;SameSite=Strict${location.protocol === 'https:' ? ';Secure' : ''}`; };
    set(s.session); this._sess = s.session;
    clearInterval(this._keep);
    this._keep = setInterval(async () => {   // giữ phiên còn hiệu lực, hết hạn thì tạo phiên mới
      try { await ws('/ingress/validate_session', 'post', { session: this._sess }); } catch (_) { try { const n = await ws('/ingress/session', 'post'); this._sess = n.session; set(n.session); } catch (e) {} }
    }, 60000);
  }
  async _get(path) { const r = await fetch(`${this._base}/${path}`, { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) throw new Error(path + ' ' + r.status); return r.json(); }

  async _init() {
    try {
      await this._ingress();
      if (/evninfo$/.test(this._src.slug)) {   // add-on EVN INFO: danh sách mã khách hàng, không lộ mật khẩu
        const acc = await this._get('accounts.json');
        this._accounts = acc.map((a) => a.code);
      } else {
        const opt = await this._get('options');
        this._accounts = JSON.parse(opt.accounts_json || '[]').map((a) => a.userevn).filter(Boolean);
      }
      if (!this._accounts.length) throw new Error('Chưa có tài khoản EVN trong add-on');
      this._data = {};
      this._acc = this._ls('acc', this._accounts[0]); if (!this._accounts.includes(this._acc)) this._acc = this._accounts[0];
      this._year = new Date().getFullYear(); this._cmp = this._ls('cmp', true);
      await this._load(this._acc);
      this._renderAll();
    } catch (e) {
      this._root.querySelector('[data-k="page"]').innerHTML = `<div class="card msg">Không đọc được dữ liệu add-on EVN.<br><span class="mut">${String(e.message || e)}</span><br><br>Kiểm tra add-on EVN CPC (hoặc EVN VN) đang chạy (cần tài khoản quản trị HA).</div>`;
    }
  }

  // tải toàn bộ dữ liệu 1 tài khoản: theo tháng (các năm có file) + theo ngày
  async _load(acc, force) {
    if (this._data[acc] && !force) return;
    const now = new Date().getFullYear(), years = {};
    await Promise.all([now - 2, now - 1, now].map(async (y) => {
      try {
        const m = await this._get(`tien_dien_san_luong_${y}_${acc}.json`);
        if (!m || !Array.isArray(m.SanLuong)) return;
        const kwh = new Array(12).fill(null), cost = new Array(12).fill(null);
        m.SanLuong.forEach((x) => { const v = parseFloat(String(x['Điện tiêu thụ (KWh)']).replace(',', '.')); if (x['Tháng'] >= 1 && x['Tháng'] <= 12 && isFinite(v)) kwh[x['Tháng'] - 1] = v; });
        (m.TienDien || []).forEach((x) => { const v = parseFloat(String(x['Tiền Điện']).replace(/[^\d.-]/g, '')); if (x['Tháng'] >= 1 && x['Tháng'] <= 12 && isFinite(v)) cost[x['Tháng'] - 1] = v; });
        if (kwh.some((v) => v != null) || cost.some((v) => v != null)) years[y] = { kwh, cost };
      } catch (_) {}
    }));
    let daily = [];
    try {
      const d = await this._get(`dien_tieu_thu_${acc}.json`);
      const seen = new Set();
      daily = (Array.isArray(d) ? d : []).map((x) => {
        const [dd, mm, yy] = String(x['Ngày'] || '').split('-').map(Number); if (!yy) return null;
        const v = parseFloat(String(x['Điện tiêu thụ (kWh)']).replace(',', '.'));
        return { d: new Date(yy, mm - 1, dd), kwh: isFinite(v) ? v : null, idx: x['Chỉ số'] && x['Chỉ số'] !== 'Không có dữ liệu' ? x['Chỉ số'] : null };
      }).filter((x) => x && !seen.has(+x.d) && seen.add(+x.d)).sort((a, b) => a.d - b.d);
    } catch (_) {}
    this._data[acc] = { years, daily };
  }

  // ---- chu kỳ hóa đơn: ngày bắt đầu s (1 = theo tháng dương lịch). Kỳ đặt tên theo tháng kết thúc (tháng hóa đơn)
  _cycle() { return this._ls('cycle-' + this._acc, 1); }
  _range(m, y) { const s = this._cycle(); return s === 1 ? [new Date(y, m - 1, 1), new Date(y, m, 0)] : [new Date(y, m - 2, s), new Date(y, m - 1, s - 1)]; }
  _curLabel(t = new Date()) { const s = this._cycle(); let m = t.getMonth() + 1, y = t.getFullYear(); if (s > 1 && t.getDate() >= s) { m++; if (m > 12) { m = 1; y++; } } return [m, y]; }
  _periods() {
    const D = this._data[this._acc].daily; if (!D.length) return [];
    const out = []; let [m, y] = this._curLabel();
    for (let i = 0; i < 36; i++) {
      const [a, b] = this._range(m, y); if (b < D[0].d) break;
      out.push([m, y]); m--; if (m < 1) { m = 12; y--; }
    }
    return out;
  }
  _days(a, b) { return this._data[this._acc].daily.filter((x) => x.d >= a && x.d <= b); }

  // =================== giao diện ===================
  _renderAll() {
    const page = this._root.querySelector('[data-k="page"]');
    const names = this._ls('names', {});
    const D = this._data[this._acc];
    const last = D.daily.filter((x) => x.kwh != null).slice(-1)[0];
    const yrs = Object.keys(D.years).map(Number).sort((a, b) => b - a);
    if (!yrs.includes(this._year)) this._year = yrs[0] || new Date().getFullYear();
    const per = this._periods(); if (!this._sel || !per.some((p) => p[0] === this._sel[0] && p[1] === this._sel[1])) this._sel = per[0] || null;
    const cyc = this._cycle();
    page.innerHTML = `
      <div class="head"><div><h1>${this.constructor.TITLE}</h1><p>${last ? 'Số liệu đến ngày ' + dvnY(last.d) : 'Chưa có số liệu theo ngày'} · dữ liệu từ add-on ${this._src.label}</p></div>
        <div class="hbtns"><div class="seg" data-k="acc">${this._accounts.map((a) => `<button data-a="${a}" class="${a === this._acc ? 'on' : ''}">${names[a] ? `${names[a]} <span class="mut">${a.slice(-4)}</span>` : a}<span class="ed" data-ed="${a}" title="Đặt tên">✎</span></button>`).join('')}</div><button class="rl" data-k="rl" title="Tải lại giao diện" aria-label="Tải lại">${ico('refresh')}</button></div></div>
      <div class="filters">
        <label class="fl">Năm <select data-k="year">${yrs.map((y) => `<option ${y === this._year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <label class="fl">Chu kỳ hóa đơn <select data-k="cycle"><option value="1" ${cyc === 1 ? 'selected' : ''}>Theo tháng (1 → cuối tháng)</option>
          ${Array.from({ length: 27 }, (_, i) => i + 2).map((d) => `<option value="${d}" ${cyc === d ? 'selected' : ''}>Từ ngày ${d} hàng tháng</option>`).join('')}</select></label>
        <button class="btn ${this._cmp ? 'on' : ''}" data-k="cmp">So với năm trước</button>
        <button class="btn" data-k="reload">${ico('refresh')} Tải lại</button>
      </div>
      <div class="kpis" data-k="kpis"></div>
      <section class="card"><div class="ch"><div><h2>Theo tháng · năm ${this._year}</h2><p>Số liệu hóa đơn EVN. Bấm vào cột để xem chi tiết kỳ đó.</p></div>
        <div class="legend"><span><i style="background:var(--blue)"></i>kWh</span><span><i style="background:var(--amber)"></i>Tiền điện</span>${this._cmp ? '<span><i style="background:var(--ghost)"></i>kWh năm trước</span>' : ''}</div></div>
        <div class="chart" data-k="mchart"></div></section>
      <div class="two">
        <section class="card"><div class="ch"><div><h2>Chi tiết kỳ</h2><p data-k="psub"></p></div>
          <select data-k="period">${per.map(([m, y]) => `<option value="${m}-${y}" ${this._sel && m === this._sel[0] && y === this._sel[1] ? 'selected' : ''}>Kỳ tháng ${m}/${y}</option>`).join('')}</select></div>
          <div class="chart sm" data-k="pchart"></div></section>
        <section class="card"><div class="ch"><div><h2>Thống kê kỳ</h2><p>Tiền tạm tính theo giá bậc thang + VAT 8%</p></div></div>
          <div class="stats" data-k="pstats"></div>
          <table class="tiers" data-k="tiers" style="margin-top:12px"></table></section>
      </div>
      <section class="card"><div class="ch"><div><h2>Tra cứu theo ngày</h2><p data-k="rsub"></p></div>
        <div class="filters"><input type="date" data-k="from"><span class="mut">→</span><input type="date" data-k="to">
          <div class="presets"><button class="btn" data-pr="7">7 ngày</button><button class="btn" data-pr="30">30 ngày</button><button class="btn" data-pr="cur">Kỳ này</button><button class="btn" data-pr="prev">Kỳ trước</button><button class="btn" data-pr="all">Tất cả</button></div></div></div>
        <div class="chart sm" data-k="rchart"></div>
        <div class="stats" data-k="rstats" style="grid-template-columns:repeat(4,minmax(0,1fr));margin:12px 0"></div>
        <div class="tbl"><table data-k="rtable"></table></div></section>`;
    this._bind();
    this._kpis(); this._monthChart(); this._periodView();
    if (!this._from) this._preset('30', true); else this._rangeView();
  }

  _bind() {
    const r = this._root, q = (k) => r.querySelector(`[data-k="${k}"]`);
    q('acc').addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-ed]');
      if (ed) { e.stopPropagation(); const names = this._ls('names', {}); const v = prompt('Tên gợi nhớ cho ' + ed.dataset.ed + ' (để trống để bỏ):', names[ed.dataset.ed] || ''); if (v !== null) { if (v.trim()) names[ed.dataset.ed] = v.trim().slice(0, 30); else delete names[ed.dataset.ed]; this._lsSet('names', names); this._renderAll(); } return; }
      const b = e.target.closest('[data-a]'); if (!b || b.dataset.a === this._acc) return;
      this._acc = b.dataset.a; this._lsSet('acc', this._acc); this._sel = null; this._from = null;
      q('page'); await this._load(this._acc); this._renderAll();
    });
    q('rl').addEventListener('click', (e) => { e.currentTarget.classList.add('spin'); hpReload(this); });
    q('year').addEventListener('change', (e) => { this._year = +e.target.value; this._renderAll(); });
    q('cycle').addEventListener('change', (e) => { this._lsSet('cycle-' + this._acc, +e.target.value); this._sel = null; this._renderAll(); });
    q('cmp').addEventListener('click', () => { this._cmp = !this._cmp; this._lsSet('cmp', this._cmp); this._renderAll(); });
    q('reload').addEventListener('click', async () => { this._data[this._acc] = null; await this._load(this._acc, true); this._renderAll(); });
    q('period').addEventListener('change', (e) => { const [m, y] = e.target.value.split('-').map(Number); this._sel = [m, y]; this._periodView(); });
    q('from').addEventListener('change', () => { this._from = q('from').value; this._rangeView(); });
    q('to').addEventListener('change', () => { this._to = q('to').value; this._rangeView(); });
    r.querySelector('.presets').addEventListener('click', (e) => { const b = e.target.closest('[data-pr]'); if (b) this._preset(b.dataset.pr); });
  }

  _kpis() {
    const D = this._data[this._acc], Y = D.years[this._year] || { kwh: [], cost: [] };
    const [cm, cy] = this._curLabel(), [a, b] = this._range(cm, cy), now = new Date();
    const cur = this._days(a, new Date(Math.min(+b, +now))), curK = cur.reduce((s, x) => s + (x.kwh || 0), 0), withData = cur.filter((x) => x.kwh > 0).length;
    const total = Math.round((b - a) / DAY) + 1, avgDay = withData ? curK / withData : 0, proj = avgDay * total;
    const costs = Y.cost.filter((v) => v != null), kwhs = Y.kwh.filter((v) => v != null);
    const sumC = costs.reduce((s, v) => s + v, 0), sumK = kwhs.reduce((s, v) => s + v, 0);
    const yDays = D.daily.filter((x) => x.d.getFullYear() === this._year && x.kwh > 0);
    const el = this._root.querySelector('[data-k="kpis"]');
    el.innerHTML = `
      <div class="kpi now"><span>${ico('bolt')} Kỳ này · tháng ${cm}/${cy} (${dvn(a)} → ${dvn(b)})</span>
        <b>${n1(curK)}<small>kWh</small> · ${n0(bill(curK).total)}<small>đ</small></b>
        <p>${withData} / ${total} ngày có số liệu · TB ${n1(avgDay, 2)} kWh/ngày · dự kiến cả kỳ ~${n0(proj)} kWh ≈ ${n0(bill(proj).total)} đ</p>
        <div class="prog"><i data-w="${Math.min(100, 100 * withData / total).toFixed(1)}"></i></div></div>
      <div class="kpi" style="--c:var(--amber)"><span>Tổng tiền năm ${this._year}</span><b>${n0(sumC)}<small>đ</small></b><p>${costs.length} tháng có hóa đơn</p></div>
      <div class="kpi" style="--c:var(--amber)"><span>TB tiền / tháng</span><b>${n0(costs.length ? sumC / costs.length : null)}<small>đ</small></b><p>năm ${this._year}</p></div>
      <div class="kpi"><span>TB tiêu thụ / tháng</span><b>${n0(kwhs.length ? sumK / kwhs.length : null)}<small>kWh</small></b><p>tổng ${n0(sumK)} kWh</p></div>
      <div class="kpi" style="--c:var(--green)"><span>TB tiêu thụ / ngày</span><b>${n1(yDays.length ? yDays.reduce((s, x) => s + x.kwh, 0) / yDays.length : null, 2)}<small>kWh</small></b><p>${yDays.length} ngày có số liệu</p></div>`;
    el.querySelectorAll('[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; });
  }

  // ---- biểu đồ theo tháng: cột kWh + đường tiền (+ cột mờ năm trước)
  _monthChart() {
    const box = this._root.querySelector('[data-k="mchart"]'), D = this._data[this._acc];
    const Y = D.years[this._year], P = this._cmp ? D.years[this._year - 1] : null;
    if (!Y) { box.innerHTML = '<div class="msg">Không có số liệu năm này</div>'; return; }
    const W = box.clientWidth || 800, H = box.clientHeight || 280, L = 44, R = 56, T = 14, B = 26, iw = W - L - R, ih = H - T - B;
    const kmax = Math.max(10, ...Y.kwh.filter((v) => v != null), ...(P ? P.kwh.filter((v) => v != null) : []));
    const cmax = Math.max(10000, ...Y.cost.filter((v) => v != null));
    const ks = Math.pow(10, Math.floor(Math.log10(kmax))) * (kmax / Math.pow(10, Math.floor(Math.log10(kmax))) > 5 ? 2 : 1), kTop = Math.ceil(kmax / ks) * ks;
    const cTop = Math.ceil(cmax / 100000) * 100000 || cmax;
    const bw = iw / 12, x = (i) => L + bw * i, yk = (v) => T + ih * (1 - v / kTop), yc = (v) => T + ih * (1 - v / cTop);
    let g = '';
    for (let i = 0; i <= 4; i++) { const v = kTop * i / 4; g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${yk(v)}" y2="${yk(v)}"/><text class="ax" x="${L - 6}" y="${yk(v) + 4}" text-anchor="end">${n0(v)}</text><text class="ax" x="${W - R + 6}" y="${yc(cTop * i / 4) + 4}">${n0(cTop * i / 4 / 1000)}k</text>`; }
    for (let i = 0; i < 12; i++) {
      if (P && P.kwh[i] != null) g += `<rect class="bg" x="${x(i) + bw * .14}" y="${yk(P.kwh[i])}" width="${bw * .72}" height="${ih - (yk(P.kwh[i]) - T)}" rx="4"/>`;
      if (Y.kwh[i] != null) { const sel = this._sel && this._sel[0] === i + 1 && this._sel[1] === this._year; g += `<rect class="bk${sel ? ' sel' : ''}" data-m="${i + 1}" x="${x(i) + bw * .24}" y="${yk(Y.kwh[i])}" width="${bw * .52}" height="${ih - (yk(Y.kwh[i]) - T)}" rx="4"/>`; }
      g += `<text class="ax" x="${x(i) + bw / 2}" y="${H - 8}" text-anchor="middle">${bw < 34 ? i + 1 : 'T' + (i + 1)}</text>`;
    }
    let p = '', pen = false; Y.cost.forEach((v, i) => { if (v == null) { pen = false; return; } p += (pen ? 'L' : 'M') + (x(i) + bw / 2).toFixed(1) + ' ' + yc(v).toFixed(1); pen = true; });
    g += `<path class="lc" d="${p}"/>` + Y.cost.map((v, i) => v == null ? '' : `<circle class="dc" cx="${x(i) + bw / 2}" cy="${yc(v)}" r="3.5"/>`).join('');
    g += `<rect data-hit x="${L}" y="${T}" width="${iw}" height="${ih}" fill="transparent"/>`;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
    const svg = box.firstChild;
    const idx = (e) => { const r = svg.getBoundingClientRect(); return Math.floor((e.clientX - r.left - L) / (r.width - L - R) * 12); };
    svg.addEventListener('pointermove', (e) => {
      const i = idx(e); if (i < 0 || i > 11) { this._tip.hidden = true; return; }
      this._showTip(e, `<b>Tháng ${i + 1}/${this._year}</b><div><span>Tiêu thụ</span><span>${n0(Y.kwh[i])} kWh</span></div><div><span>Tiền điện</span><span>${n0(Y.cost[i])} đ</span></div>` +
        (P ? `<div><span>Năm ${this._year - 1}</span><span>${n0(P.kwh[i])} kWh</span></div>` : '') + (Y.kwh[i] && Y.cost[i] ? `<div><span>Giá TB</span><span>${n0(Y.cost[i] / Y.kwh[i])} đ/kWh</span></div>` : ''));
    });
    svg.addEventListener('pointerleave', () => { this._tip.hidden = true; });
    svg.addEventListener('click', (e) => {
      const i = idx(e); if (i < 0 || i > 11) return;
      const opt = this._root.querySelector(`[data-k="period"] option[value="${i + 1}-${this._year}"]`);
      if (opt) { this._sel = [i + 1, this._year]; opt.selected = true; this._periodView(); this._monthChart(); this._root.querySelector('[data-k="pchart"]').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  }

  // ---- chi tiết 1 kỳ
  _periodView() {
    const box = this._root.querySelector('[data-k="pchart"]'), st = this._root.querySelector('[data-k="pstats"]'), tb = this._root.querySelector('[data-k="tiers"]');
    if (!this._sel) { box.innerHTML = '<div class="msg">Chưa có số liệu theo ngày</div>'; st.innerHTML = ''; tb.innerHTML = ''; return; }
    const [m, y] = this._sel, [a, b] = this._range(m, y), days = this._days(a, b), val = days.filter((x) => x.kwh > 0);
    const sum = val.reduce((s, x) => s + x.kwh, 0), avg = val.length ? sum / val.length : 0;
    const mx = val.reduce((p, x) => (!p || x.kwh > p.kwh ? x : p), null), mn = val.reduce((p, x) => (!p || x.kwh < p.kwh ? x : p), null);
    const pm = m === 1 ? [12, y - 1] : [m - 1, y], [pa, pb] = this._range(...pm), pv = this._days(pa, pb).filter((x) => x.kwh > 0), pavg = pv.length ? pv.reduce((s, x) => s + x.kwh, 0) / pv.length : null;
    const tr = pavg ? (avg - pavg) / pavg * 100 : null;
    const Y = this._data[this._acc].years[y], official = Y && this._cycle() === 1 ? Y.cost[m - 1] : null, est = bill(sum);
    this._root.querySelector('[data-k="psub"]').textContent = `${dvnY(a)} → ${dvnY(b)} · ${val.length} ngày có số liệu`;
    st.innerHTML = `
      <div><span>Tổng tiêu thụ</span><b>${n1(sum, 2)} kWh</b></div>
      <div><span>${official != null ? 'Tiền điện (hóa đơn)' : 'Tiền điện tạm tính'}</span><b>${n0(official != null ? official : est.total)} đ</b></div>
      <div><span>Trung bình / ngày</span><b>${n1(avg, 2)} kWh</b></div>
      <div><span>So với kỳ trước</span><b class="${tr == null ? '' : tr > 0 ? 'up' : 'down'}">${tr == null ? '–' : (tr > 0 ? '▲ +' : '▼ ') + n1(tr) + '%'}</b></div>
      <div><span>Ngày cao nhất</span><b>${mx ? `${n1(mx.kwh, 2)} kWh · ${dvn(mx.d)}` : '–'}</b></div>
      <div><span>Ngày thấp nhất</span><b>${mn ? `${n1(mn.kwh, 2)} kWh · ${dvn(mn.d)}` : '–'}</b></div>`;
    tb.innerHTML = `<thead><tr><th>Bậc</th><th>kWh</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>` +
      est.rows.map((x) => `<tr><td>Bậc ${x.tier}</td><td>${n1(x.kwh, 2)}</td><td>${n0(x.price)}</td><td>${n0(x.cost)}</td></tr>`).join('') +
      `<tr><td>VAT 8%</td><td></td><td></td><td>${n0(est.vat)}</td></tr></tbody><tfoot><tr><td>Tổng</td><td>${n1(sum, 2)}</td><td></td><td>${n0(est.total)} đ</td></tr></tfoot>`;
    this._dayChart(box, days, a, b);
  }

  // ---- biểu đồ cột theo ngày (cao nhất đỏ, thấp nhất xanh lá)
  _dayChart(box, days, a, b) {
    const n = Math.round((b - a) / DAY) + 1;
    if (n <= 0 || n > 800) { box.innerHTML = '<div class="msg">Khoảng ngày không hợp lệ</div>'; return; }
    const byKey = new Map(days.map((x) => [dkey(x.d), x])), arr = Array.from({ length: n }, (_, i) => { const d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i); return { d, x: byKey.get(dkey(d)) }; });
    const vals = arr.map((o) => o.x && o.x.kwh != null ? o.x.kwh : null), vv = vals.filter((v) => v != null);
    if (!vv.length) { box.innerHTML = '<div class="msg">Không có số liệu trong khoảng này</div>'; return; }
    const W = box.clientWidth || 600, H = box.clientHeight || 220, L = 36, R = 10, T = 10, B = 24, iw = W - L - R, ih = H - T - B;
    const max = Math.max(...vv), mn = Math.min(...vv), top = Math.ceil(max * 1.1) || 1, bw = iw / n, y = (v) => T + ih * (1 - v / top);
    let g = ''; for (let i = 0; i <= 4; i++) { const v = top * i / 4; g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${n1(v, v < 10 ? 1 : 0)}</text>`; }
    const step = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(iw / 48))));
    arr.forEach((o, i) => {
      const v = vals[i];
      if (v != null) g += `<rect class="bd${v === max ? ' max' : v === mn ? ' min' : ''}" x="${L + bw * i + bw * .15}" y="${y(v)}" width="${Math.max(1, bw * .7)}" height="${ih - (y(v) - T)}" rx="${Math.min(3, bw * .3)}"/>`;
      if (i % step === 0) g += `<text class="ax" x="${L + bw * i + bw / 2}" y="${H - 7}" text-anchor="middle">${dvn(o.d)}</text>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
    const svg = box.firstChild;
    svg.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - L) / (r.width - L - R) * n);
      if (i < 0 || i >= n) { this._tip.hidden = true; return; }
      const o = arr[i]; this._showTip(e, `<b>${o.d.toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric' })}</b><div><span>Tiêu thụ</span><span>${o.x && o.x.kwh != null ? n1(o.x.kwh, 2) + ' kWh' : 'Không có'}</span></div>` + (o.x && o.x.idx ? `<div><span>Chỉ số</span><span>${o.x.idx}</span></div>` : ''));
    });
    svg.addEventListener('pointerleave', () => { this._tip.hidden = true; });
  }

  // ---- tra cứu theo khoảng ngày
  _preset(p, silent) {
    const D = this._data[this._acc].daily; if (!D.length) return;
    const last = D[D.length - 1].d; let a, b = new Date(Math.min(+last, Date.now()));
    if (p === '7' || p === '30') a = new Date(b.getTime() - (+p - 1) * DAY);
    else if (p === 'all') a = D[0].d;
    else { let [m, y] = this._curLabel(); if (p === 'prev') { m--; if (m < 1) { m = 12; y--; } } [a, b] = this._range(m, y); }
    this._from = dkey(a); this._to = dkey(b);
    this._rangeView();
  }
  _rangeView() {
    const q = (k) => this._root.querySelector(`[data-k="${k}"]`);
    q('from').value = this._from || ''; q('to').value = this._to || '';
    if (!this._from || !this._to) return;
    const [fy, fm, fd] = this._from.split('-').map(Number), [ty, tm, td] = this._to.split('-').map(Number);
    let a = new Date(fy, fm - 1, fd), b = new Date(ty, tm - 1, td); if (a > b) [a, b] = [b, a];
    const days = this._days(a, b), val = days.filter((x) => x.kwh > 0), sum = val.reduce((s, x) => s + x.kwh, 0);
    q('rsub').textContent = `${dvnY(a)} → ${dvnY(b)} · ${val.length} ngày có số liệu`;
    this._dayChart(q('rchart'), days, a, b);
    const mx = val.length ? Math.max(...val.map((x) => x.kwh)) : null;
    q('rstats').innerHTML = `<div><span>Tổng</span><b>${n1(sum, 2)} kWh</b></div><div><span>Trung bình/ngày</span><b>${n1(val.length ? sum / val.length : null, 2)} kWh</b></div>
      <div><span>Cao nhất</span><b>${n1(mx, 2)} kWh</b></div><div><span>Tiền tạm tính</span><b>${n0(bill(sum).total)} đ</b></div>`;
    // bảng: bấm tiêu đề để sắp xếp
    const sort = this._sort || { k: 'd', asc: false };
    const rows = val.slice().sort((x, y) => (sort.k === 'd' ? x.d - y.d : x.kwh - y.kwh) * (sort.asc ? 1 : -1));
    const th = (k, t) => `<th data-s="${k}" class="${sort.k === k ? 's' + (sort.asc ? ' asc' : '') : ''}">${t}</th>`;
    const t = q('rtable');
    t.innerHTML = `<thead><tr>${th('d', 'Ngày')}${th('k', 'Tiêu thụ (kWh)')}<th>Chỉ số</th></tr></thead><tbody>` +
      rows.map((x) => `<tr><td>${x.d.toLocaleDateString('vi-VN', { weekday: 'short' })} ${dvnY(x.d)}</td><td>${n1(x.kwh, 2)}</td><td class="mut">${x.idx || '–'}</td></tr>`).join('') +
      `</tbody><tfoot><tr><td>Tổng ${rows.length} ngày</td><td>${n1(sum, 2)}</td><td></td></tr></tfoot>`;
    t.querySelector('thead').onclick = (e) => { const h = e.target.closest('[data-s]'); if (!h) return; const k = h.dataset.s; this._sort = { k, asc: sort.k === k ? !sort.asc : k === 'd' }; this._rangeView(); };
  }

  _showTip(e, html) {
    const t = this._tip; t.innerHTML = html; t.hidden = false;
    const x = e.clientX + 14 + t.offsetWidth > innerWidth ? e.clientX - t.offsetWidth - 14 : e.clientX + 14;
    t.style.left = x + 'px'; t.style.top = Math.max(8, e.clientY - t.offsetHeight - 10) + 'px';
  }
}
if (!customElements.get('hp-evn-panel')) customElements.define('hp-evn-panel', HpEvnPanel);
// Thẻ thử add-on mới (EVN INFO): cùng giao diện, lưu lựa chọn riêng
class HpEvnCpcPanel extends HpEvnPanel { static ADDON = ['local_evninfo', 'EVN INFO']; static TITLE = 'EVN INFO (thử)'; static KEY = 'hp-evncpc-'; }
if (!customElements.get('hp-evncpc-panel')) customElements.define('hp-evncpc-panel', HpEvnCpcPanel);
