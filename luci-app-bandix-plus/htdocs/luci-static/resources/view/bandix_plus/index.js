'use strict';
'require view';
'require dom';
'require ui';
'require uci';
'require rpc';
'require poll';

var callGetOverview = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'getOverview',
	params: [ 'period' ],
	expect: {}
});

var callGetDevices = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'getDevices',
	params: [ 'iface', 'period' ],
	expect: {}
});

var callGetTrend = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'getTrend',
	params: [ 'iface', 'mac', 'traffic_type', 'direction' ],
	expect: {}
});

var callGetHistogram = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'getHistogram',
	params: [ 'iface', 'mac', 'traffic_type', 'start_ms', 'end_ms', 'bucket' ],
	expect: {}
});

var callSetDeviceHostname = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'setDeviceHostname',
	params: [ 'payload' ],
	expect: {}
});

var callGetPolicy = rpc.declare({ object: 'luci.bandix_plus', method: 'getPolicy', expect: {} });
var callGetSchedules = rpc.declare({ object: 'luci.bandix_plus', method: 'getSchedules', expect: {} });
var callCreateSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'createSchedule', params: [ 'payload' ], expect: {} });
var callUpdateSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'updateSchedule', params: [ 'pair' ], expect: {} });
var callDeleteSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'deleteSchedule', params: [ 'id' ], expect: {} });
var callGetIfaceLimits = rpc.declare({ object: 'luci.bandix_plus', method: 'getIfaceLimits', expect: {} });
var callSetIfaceLimit = rpc.declare({ object: 'luci.bandix_plus', method: 'setIfaceLimit', params: [ 'payload' ], expect: {} });
var callDeleteIfaceLimit = rpc.declare({ object: 'luci.bandix_plus', method: 'deleteIfaceLimit', params: [ 'iface' ], expect: {} });
var callGetGuestDefaults = rpc.declare({ object: 'luci.bandix_plus', method: 'getGuestDefaults', expect: {} });
var callSetGuestDefault = rpc.declare({ object: 'luci.bandix_plus', method: 'setGuestDefault', params: [ 'payload' ], expect: {} });
var callDeleteGuestDefault = rpc.declare({ object: 'luci.bandix_plus', method: 'deleteGuestDefault', params: [ 'iface' ], expect: {} });
var callGetGuestWhitelist = rpc.declare({ object: 'luci.bandix_plus', method: 'getGuestWhitelist', expect: {} });
var callAddGuestWhitelist = rpc.declare({ object: 'luci.bandix_plus', method: 'addGuestWhitelist', params: [ 'payload' ], expect: {} });
var callRemoveGuestWhitelist = rpc.declare({ object: 'luci.bandix_plus', method: 'removeGuestWhitelist', params: [ 'payload' ], expect: {} });
var callGetVersion = rpc.declare({ object: 'luci.bandix_plus', method: 'getVersion', expect: {} });

function bplusJson(r) {
	if (r == null) return null;
	if (typeof r === 'string') {
		try {
			return JSON.parse(r);
		}
		catch (e) {
			return null;
		}
	}
	return r;
}

function unwrapData(r, fallback) {
	var z = bplusJson(r);
	if (z == null) return fallback;
	if (z.ok === false) {
		throw new Error(z.error || 'RPC error');
	}
	if (z.data == null) return fallback;
	return z.data;
}

function asNum(v) {
	var n = +v;
	return isFinite(n) ? n : 0;
}

function sumBps(x) {
	if (!x) return 0;
	return asNum(x.up_v4_bps) + asNum(x.up_v6_bps) + asNum(x.down_v4_bps) + asNum(x.down_v6_bps);
}

function sumUpBps(x) {
	if (!x) return 0;
	return asNum(x.up_v4_bps) + asNum(x.up_v6_bps);
}

function sumDownBps(x) {
	if (!x) return 0;
	return asNum(x.down_v4_bps) + asNum(x.down_v6_bps);
}

function sumBytes(x) {
	if (!x) return 0;
	return asNum(x.up_v4_bytes) + asNum(x.up_v6_bytes) + asNum(x.down_v4_bytes) + asNum(x.down_v6_bytes);
}

function sumUpBytes(x) {
	if (!x) return 0;
	return asNum(x.up_v4_bytes) + asNum(x.up_v6_bytes);
}

function sumDownBytes(x) {
	if (!x) return 0;
	return asNum(x.down_v4_bytes) + asNum(x.down_v6_bytes);
}

function formatBytes(n) {
	n = asNum(n);
	if (n <= 0) return '0 B';
	var u = [ 'B', 'KB', 'MB', 'GB', 'TB', 'PB' ];
	var i = 0;
	while (n >= 1024 && i < u.length - 1) {
		n /= 1024;
		i++;
	}
	return (i === 0 ? String(Math.round(n)) : n.toFixed(2)) + ' ' + u[i];
}

function formatRate(n) {
	n = asNum(n);
	if (n <= 0) return '0 B/s';
	var u = [ 'B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s' ];
	var i = 0;
	while (n >= 1024 && i < u.length - 1) {
		n /= 1024;
		i++;
	}
	return (i === 0 ? String(Math.round(n)) : n.toFixed(2)) + ' ' + u[i];
}

/** CounterQuad *_bps → byte/s for display (align bandix-plus-web). */
function formatBpsAsByteRate(bps) {
	return formatRate(asNum(bps) / 8);
}

function compareVal(a, b) {
	if (a === b) return 0;
	if (a == null) return -1;
	if (b == null) return 1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b));
}

function dateStartMs(s) {
	if (!s) return null;
	var d = new Date(s + 'T00:00:00');
	if (isNaN(d.getTime())) return null;
	return d.getTime();
}

function dateEndMs(s) {
	if (!s) return null;
	var d = new Date(s + 'T23:59:59');
	if (isNaN(d.getTime())) return null;
	return d.getTime();
}

function daysText(days) {
	if (!days || !days.length) return '—';
	return days.join(',');
}

var BPLUS_TREND_MAX_POINTS = 1200;
var BPLUS_TREND_MAX_RATE_BPS = 1024 * 1024 * 1024 * 10; // 10 GB/s guardrail
/* Chart CSS size: parent width + fixed height (same idea as luci-app-bandix drawIncrementsChart / #history-canvas). */
var BPLUS_TREND_CHART_CSS_H = 220;
var BPLUS_STATS_CHART_CSS_H = 280;

function mapLimit(list, limit, mapper) {
	limit = Math.max(1, limit | 0);
	var idx = 0;
	var running = 0;
	var out = new Array(list.length);
	return new Promise(function (resolve, reject) {
		function pump() {
			if (idx >= list.length && running === 0) {
				resolve(out);
				return;
			}
			while (running < limit && idx < list.length) {
				(function (i) {
					running++;
					Promise.resolve(mapper(list[i], i)).then(function (v) {
						out[i] = v;
						running--;
						pump();
					}).catch(function (e) {
						reject(e);
					});
				})(idx++);
			}
		}
		pump();
	});
}

function getThemeMode() {
	var theme = uci.get('luci', 'main', 'mediaurlbase');
	if (theme === '/luci-static/openwrt2020' || theme === '/luci-static/material' || theme === '/luci-static/bootstrap-light')
		return 'light';
	if (theme === '/luci-static/bootstrap-dark')
		return 'dark';
	if (theme === '/luci-static/argon') {
		var am = uci.get('argon', '@global[0]', 'mode');
		if (am === 'light' || am === 'dark') return am;
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
			return 'dark';
		return 'light';
	}
	if (theme === '/luci-static/bootstrap' || theme === '/luci-static/aurora') {
		var html = document.documentElement;
		return html.getAttribute('data-darkmode') === 'true' ? 'dark' : 'light';
	}
	if (theme === '/luci-static/kucat') {
		var km = uci.get('kucat', '@basic[0]', 'mode');
		if (km === 'light' || km === 'dark') return km;
		if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
			return 'dark';
		return 'light';
	}
	if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
		return 'dark';
	return 'light';
}

function ensureLayoutCss() {
	if (document.getElementById('bplus-layout-css-v2')) return;
	var st = document.createElement('style');
	st.id = 'bplus-layout-css-v2';
	st.type = 'text/css';
	st.textContent = [
		'.bplus-page{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;}',
		'.bplus-page .bplus-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 4px 0;}',
		'.bplus-page .bplus-title-wrapper{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px 20px;}',
		'.bplus-page .bplus-title{font-size:1.5rem;font-weight:600;margin:0;line-height:1.2;}',
		'.bplus-page .bplus-version{font-size:0.875rem;opacity:0.55;font-weight:400;}',
		'.bplus-page .bplus-section-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 12px 0;}',
		'.bplus-page .bplus-section-head .bplus-panel-title{margin:0;font-size:1.1rem;font-weight:600;flex:1 1 auto;min-width:8em;}',
		'.bplus-page .bplus-trend-toolbar,.bplus-page .bplus-device-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;justify-content:flex-end;}',
		'.bplus-page .bplus-trend-toolbar .cbi-input-select,.bplus-page .bplus-device-toolbar .cbi-input-select{min-width:6em;}',
		'.bplus-page .bplus-section{margin-top:1.25rem;}',
		'.bplus-page .bplus-section>h3{margin:0 0 12px 0;font-size:1.1rem;font-weight:600;}'
	].join('');
	document.head.appendChild(st);
}

function ensureCss() {
	if (!document.getElementById('bplus-status-css')) {
		document.head.appendChild(E('link', {
			'id': 'bplus-status-css',
			'rel': 'stylesheet',
			'type': 'text/css',
			'href': L.resource('bandix_plus/status.css', '?v=23')
		}));
	}
	ensureLayoutCss();
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('bandix_plus'),
			uci.load('luci').catch(function () { return null; }),
			uci.load('argon').catch(function () { return null; }),
			uci.load('kucat').catch(function () { return null; }),
			callGetVersion().then(bplusJson).catch(function () { return {}; })
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	addFooter: function () { return null; },

	initState: function (load) {
		this.version = load && load[4] ? load[4] : {};
		this.period = localStorage.getItem('bplus_period') || 'all';
		this.selectedIface = '';
		this.selectedTrendMac = '';
		this.selectedTrendType = 'all';
		this.selectedTrendDirection = '';
		this.devicesFilterIface = '';
		this.overviewError = null;
		this.liveRefreshError = null;
		this.deviceSortKey = 'rate_total';
		this.deviceSortAsc = false;
		this.scheduleEditingId = null;
		this.overview = [];
		this.devices = [];
		this.trend = [];
		this.trendRaw = [];
		this.histogram = [];
		this.chartScale = 1;
		this.chartOffset = 0;
		this.chartHoverIndex = null;
		this.statsHoverIndex = null;
		this.rate = {
			policy: [],
			schedules: [],
			ifaceLimits: [],
			guestDefaults: [],
			guestWhitelist: []
		};
		this.schDayChecks = [];
	},

	setThemeClass: function () {
		var m = getThemeMode();
		this.root.classList.remove('theme-light', 'theme-dark');
		this.root.classList.add('theme-' + m);
	},

	applyPeriod: function (v) {
		return v === 'all' ? '' : v;
	},

	setBusy: function (btn, busy) {
		if (!btn) return;
		btn.disabled = !!busy;
	},

	notifyError: function (msg, err) {
		var txt = msg;
		if (err && err.message) txt += ': ' + err.message;
		ui.addNotification(null, E('p', {}, [ txt ]));
	},

	refreshLive: function (showErr) {
		var self = this;
		var p = this.applyPeriod(this.period);
		var devIface = this.devicesFilterIface || '';
		this.overviewError = null;
		this.liveRefreshError = null;
		return Promise.all([
			callGetOverview(p).then(function (r) { return unwrapData(r, []); }).catch(function (e) {
				self.overviewError = e.message || String(e);
				return [];
			}),
			callGetDevices(devIface, p).then(function (r) { return unwrapData(r, []); }).catch(function (e) {
				self.liveRefreshError = e.message || String(e);
				return [];
			})
		]).then(L.bind(function (res) {
			this.overview = res[0] || [];
			this.devices = res[1] || [];

			if (!this.selectedIface && this.overview.length) {
				this.selectedIface = this.overview[0].ifname;
			}
			if (this.selectedIface && this.overview.length) {
				var has = false;
				for (var i = 0; i < this.overview.length; i++) {
					if (this.overview[i].ifname === this.selectedIface) {
						has = true;
						break;
					}
				}
				if (!has) this.selectedIface = this.overview[0].ifname;
			}

			this.renderIfaceOptions();
			this.renderDevicesIfaceFilterOptions();
			this.renderTrendDeviceOptions();
			this.renderStatsIfaceOptions();
			this.renderStatsMacOptions();
			this.renderOverviewGrid();
			this.renderDevicesTable();
			this.syncRateFormIfaceOptions();
			if (this.el.overviewCount) {
				this.el.overviewCount.textContent = String(this.overview.length) + ' 条';
			}
			return this.refreshTrend(false);
		}, this)).catch(L.bind(function (e) {
			this.liveRefreshError = e.message || String(e);
			if (showErr) this.notifyError(_('Failed to refresh status'), e);
		}, this));
	},

	trendPointByteRates: function (x) {
		var tt = String(this.selectedTrendType || '').trim();
		var di = String(this.selectedTrendDirection || '').trim();
		var u4 = asNum(x.up_v4_bps), u6 = asNum(x.up_v6_bps), d4 = asNum(x.down_v4_bps), d6 = asNum(x.down_v6_bps);
		if (tt === 'ipv4') {
			u6 = 0;
			d6 = 0;
		}
		if (tt === 'ipv6') {
			u4 = 0;
			d4 = 0;
		}
		var upBps = u4 + u6;
		var downBps = d4 + d6;
		if (di === 'up') downBps = 0;
		if (di === 'down') upBps = 0;
		var up = upBps / 8;
		var down = downBps / 8;
		if (up < 0) up = 0;
		if (down < 0) down = 0;
		if (up * 8 > BPLUS_TREND_MAX_RATE_BPS) up = BPLUS_TREND_MAX_RATE_BPS / 8;
		if (down * 8 > BPLUS_TREND_MAX_RATE_BPS) down = BPLUS_TREND_MAX_RATE_BPS / 8;
		return { ts_ms: asNum(x.ts_ms), up: up, down: down };
	},

	refreshTrend: function (showErr) {
		if (!this.selectedIface) {
			this.trend = [];
			this.trendRaw = [];
			this.drawTrendChart();
			if (this.el.trendCount) this.el.trendCount.textContent = '0 ' + _('entries');
			return Promise.resolve();
		}
		var mac = this.selectedTrendMac || '';
		var dir = this.selectedTrendDirection || '';
		var tt = this.selectedTrendType === 'all' ? '' : (this.selectedTrendType || '');
		return callGetTrend(this.selectedIface, mac, tt, dir)
			.then(function (r) { return unwrapData(r, []); })
			.then(L.bind(function (list) {
				var arr = Array.isArray(list) ? list : [];
				this.trendRaw = arr;
				var mapped = arr.map(L.bind(function (x) {
					return this.trendPointByteRates(x);
				}, this));
				this.trend = mapped.length > BPLUS_TREND_MAX_POINTS
					? mapped.slice(mapped.length - BPLUS_TREND_MAX_POINTS)
					: mapped;
				if (!this.trend.length) {
					this.chartScale = 1;
					this.chartOffset = 0;
					this.chartHoverIndex = null;
				}
				if (this.el.trendCount) {
					this.el.trendCount.textContent = String(this.trend.length) + ' ' + _('entries');
				}
				this.drawTrendChart();
			}, this)).catch(L.bind(function (e) {
			this.trend = [];
			this.trendRaw = [];
			this.drawTrendChart();
			if (this.el.trendCount) this.el.trendCount.textContent = '0 ' + _('entries');
			if (showErr) this.notifyError(_('Failed to refresh trend'), e);
		}, this));
	},

	refreshRateData: function (showErr) {
		return Promise.all([
			callGetPolicy().then(function (r) { return unwrapData(r, []); }),
			callGetSchedules().then(function (r) { return unwrapData(r, []); }),
			callGetIfaceLimits().then(function (r) { return unwrapData(r, []); }),
			callGetGuestDefaults().then(function (r) { return unwrapData(r, []); }),
			callGetGuestWhitelist().then(function (r) { return unwrapData(r, []); })
		]).then(L.bind(function (res) {
			this.rate.policy = res[0] || [];
			this.rate.schedules = res[1] || [];
			this.rate.ifaceLimits = res[2] || [];
			this.rate.guestDefaults = res[3] || [];
			this.rate.guestWhitelist = res[4] || [];
			this.renderPolicyTable();
			this.renderSchedulesTable();
			this.renderIfaceLimitTable();
			this.renderGuestDefaultTable();
			this.renderWhitelistTable();
		}, this)).catch(L.bind(function (e) {
			if (showErr) this.notifyError(_('Failed to refresh rate-limit data'), e);
		}, this));
	},

	overviewHeroSpeed: function (title, totalBpsOrBytes, v4v, v6v, bytesMode, dir, cumTotalBytes, cumV4Bytes, cumV6Bytes) {
		var totalS = bytesMode ? formatBytes(totalBpsOrBytes) : formatBpsAsByteRate(totalBpsOrBytes);
		var v4S = bytesMode ? formatBytes(v4v) : formatBpsAsByteRate(v4v);
		var v6S = bytesMode ? formatBytes(v6v) : formatBpsAsByteRate(v6v);
		var cls = 'overview-hero-speed overview-hero-speed--' + dir + (bytesMode ? ' overview-hero-speed--bytes' : '');
		var wrapBits = [
			E('span', { 'class': 'overview-hero-speed__total' }, [ totalS ])
		];
		if (!bytesMode)
			wrapBits.push(E('span', { 'class': 'overview-hero-speed__cum' }, [ '(' + formatBytes(cumTotalBytes) + ')' ]));
		var splitBits;
		if (!bytesMode) {
			splitBits = [
				E('div', { 'class': 'overview-hero-speed__split-row' }, [
					E('span', { 'class': 'overview-hero-speed__split-rate' }, [ 'IPv4 ' + v4S ]),
					E('span', { 'class': 'overview-hero-speed__cum' }, [ '(' + formatBytes(cumV4Bytes) + ')' ])
				]),
				E('div', { 'class': 'overview-hero-speed__split-row' }, [
					E('span', { 'class': 'overview-hero-speed__split-rate' }, [ 'IPv6 ' + v6S ]),
					E('span', { 'class': 'overview-hero-speed__cum' }, [ '(' + formatBytes(cumV6Bytes) + ')' ])
				])
			];
		} else {
			splitBits = [
				E('span', { 'class': 'overview-hero-speed__split-item' }, [ 'IPv4 ' + v4S ]),
				E('span', { 'class': 'overview-hero-speed__split-item' }, [ 'IPv6 ' + v6S ])
			];
		}
		return E('div', { 'class': cls }, [
			E('div', { 'class': 'overview-hero-speed__title-row' }, [
				E('span', { 'class': 'overview-hero-speed__title' }, [ title ])
			]),
			E('div', { 'class': 'overview-hero-speed__rates-row' }, [
				E('div', { 'class': 'overview-hero-speed__total-wrap' }, wrapBits)
			]),
			E('div', { 'class': 'overview-hero-speed__split' }, splitBits)
		]);
	},

	renderOverviewGrid: function () {
		var grid = this.el.overviewGrid;
		if (!grid) return;
		dom.content(grid, []);
		if (this.overviewError) {
			grid.appendChild(E('div', { 'class': 'overview-state overview-state--error' }, [ this.overviewError ]));
			return;
		}
		if (!this.overview.length) {
			grid.appendChild(E('div', { 'class': 'overview-state overview-state--empty' }, [ '暂无数据' ]));
			return;
		}
		for (var i = 0; i < this.overview.length; i++) {
			var item = this.overview[i];
			var metrics = item.metrics || {};
			var cumulative = item.cumulative || {};
			var upBps = asNum(metrics.up_v4_bps) + asNum(metrics.up_v6_bps);
			var downBps = asNum(metrics.down_v4_bps) + asNum(metrics.down_v6_bps);
			var cumUp = asNum(cumulative.up_v4_bytes) + asNum(cumulative.up_v6_bytes);
			var cumDown = asNum(cumulative.down_v4_bytes) + asNum(cumulative.down_v6_bytes);
			var zoneStr = item.zone != null ? String(item.zone) : '';
			var headBits = [ E('div', { 'class': 'overview-card__title' }, [ String(item.ifname != null ? item.ifname : '') || '—' ]) ];
			if (zoneStr) {
				headBits.push(E('div', { 'class': 'overview-card__badges' }, [
					E('span', { 'class': 'overview-pill overview-pill--zone' }, [ zoneStr ])
				]));
			}
			var card = E('article', { 'class': 'overview-card' }, [
				E('div', { 'class': 'overview-card__head' }, headBits),
				E('section', { 'class': 'overview-card__block overview-card__block--rate' }, [
					E('div', { 'class': 'overview-hero-pair' }, [
						this.overviewHeroSpeed(_('Upload'), upBps, metrics.up_v4_bps, metrics.up_v6_bps, false, 'up', cumUp, cumulative.up_v4_bytes, cumulative.up_v6_bytes),
						this.overviewHeroSpeed(_('Download'), downBps, metrics.down_v4_bps, metrics.down_v6_bps, false, 'down', cumDown, cumulative.down_v4_bytes, cumulative.down_v6_bytes)
					])
				])
			]);
			grid.appendChild(card);
		}
	},

	renderDevicesIfaceFilterOptions: function () {
		var sel = this.el.devicesIfaceSelect;
		if (!sel) return;
		var old = this.devicesFilterIface;
		var seen = {};
		var opts = [ E('option', { 'value': '' }, [ _('All interfaces') ]) ];
		for (var i = 0; i < this.overview.length; i++) {
			var n = this.overview[i].ifname;
			if (n && !seen[n]) {
				seen[n] = 1;
				opts.push(E('option', { 'value': n }, [ n ]));
			}
		}
		for (var j = 0; j < this.devices.length; j++) {
			var li = this.devices[j].logical_iface;
			if (li && !seen[li]) {
				seen[li] = 1;
				opts.push(E('option', { 'value': li }, [ li ]));
			}
		}
		dom.content(sel, opts);
		if (old) sel.value = old;
		if (sel.value !== old) this.devicesFilterIface = sel.value || '';
	},

	renderIfaceOptions: function () {
		var sel = this.el.ifaceSelect;
		if (!sel) return;
		var old = this.selectedIface;
		dom.content(sel, []);
		for (var i = 0; i < this.overview.length; i++) {
			var o = this.overview[i];
			sel.appendChild(E('option', { 'value': o.ifname }, [ o.ifname + ' (' + (o.zone || '—') + ')' ]));
		}
		if (old) sel.value = old;
		if (!sel.value && this.overview.length) {
			sel.value = this.overview[0].ifname;
			this.selectedIface = sel.value;
		}
	},

	renderTrendDeviceOptions: function () {
		var sel = this.el.trendDeviceSelect;
		if (!sel) return;
		var old = this.selectedTrendMac;
		dom.content(sel, [ E('option', { 'value': '' }, [ _('All Devices') ]) ]);
		var iface = this.selectedIface;
		var list = this.devices.filter(function (d) {
			return !iface || d.logical_iface === iface;
		});
		list.sort(function (a, b) {
			return String(a.mac).localeCompare(String(b.mac));
		});
		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			var label = (d.hostname || '—') + ' | ' + d.mac;
			sel.appendChild(E('option', { 'value': d.mac }, [ label ]));
		}
		sel.value = old;
		if (sel.value !== old) {
			this.selectedTrendMac = sel.value || '';
		}
	},

	renderStatsIfaceOptions: function () {
		var sel = this.el.statsIface;
		if (!sel) return;
		var old = sel.value || this.selectedIface;
		dom.content(sel, []);
		for (var i = 0; i < this.overview.length; i++) {
			var o = this.overview[i];
			sel.appendChild(E('option', { 'value': o.ifname }, [ o.ifname + ' (' + (o.zone || '—') + ')' ]));
		}
		if (old) sel.value = old;
		if (!sel.value && this.overview.length) sel.value = this.overview[0].ifname;
		this.renderStatsMacOptions();
	},

	renderStatsMacOptions: function () {
		var sel = this.el.statsMacSelect;
		if (!sel) return;
		var old = sel.value;
		var iface = this.el.statsIface ? this.el.statsIface.value : '';
		dom.content(sel, [ E('option', { 'value': '' }, [ _('All devices') ]) ]);
		var list = this.devices.filter(function (d) {
			return !iface || d.logical_iface === iface;
		});
		list.sort(function (a, b) {
			return String(a.mac).localeCompare(String(b.mac));
		});
		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			sel.appendChild(E('option', { 'value': d.mac }, [ (d.hostname || d.mac) + ' · ' + d.mac ]));
		}
		if (old) sel.value = old;
	},

	getSortedDevices: function () {
		var self = this;
		var list = this.devices.slice();
		var key = this.deviceSortKey;
		list.sort(function (a, b) {
			var av, bv;
			if (key === 'online') {
				av = a.online ? 1 : 0;
				bv = b.online ? 1 : 0;
			}
			else if (key === 'host') {
				av = (a.hostname || '').toLowerCase();
				bv = (b.hostname || '').toLowerCase();
			}
			else if (key === 'iface') {
				av = a.logical_iface || '';
				bv = b.logical_iface || '';
			}
			else if (key === 'rate_up') {
				av = sumUpBps(a.metrics);
				bv = sumUpBps(b.metrics);
			}
			else if (key === 'rate_down') {
				av = sumDownBps(a.metrics);
				bv = sumDownBps(b.metrics);
			}
			else if (key === 'rate_total') {
				av = sumBps(a.metrics);
				bv = sumBps(b.metrics);
			}
			else if (key === 'cum') {
				av = sumBytes(a.cumulative);
				bv = sumBytes(b.cumulative);
			}
			else if (key === 'ifindex') {
				av = asNum(a.ifindex);
				bv = asNum(b.ifindex);
			}
			else if (key === 'subnet') {
				av = a.subnet || '';
				bv = b.subnet || '';
			}
			else if (key === 'neighbor') {
				av = a.neighbor_state || '';
				bv = b.neighbor_state || '';
			}
			else if (key === 'cum_up') {
				av = sumUpBytes(a.cumulative);
				bv = sumUpBytes(b.cumulative);
			}
			else if (key === 'cum_down') {
				av = sumDownBytes(a.cumulative);
				bv = sumDownBytes(b.cumulative);
			}
			else if (key === 'mac') {
				av = a.mac || '';
				bv = b.mac || '';
			}
			else {
				av = a.mac || '';
				bv = b.mac || '';
			}
			var cmp = compareVal(av, bv);
			if (cmp === 0) cmp = compareVal(a.mac || '', b.mac || '');
			return self.deviceSortAsc ? cmp : -cmp;
		});
		return list;
	},

	renderDevicesTable: function () {
		var self = this;
		var head = this.el.deviceHead;
		var body = this.el.deviceBody;
		dom.content(head, []);
		dom.content(body, []);

		function sortable(label, key) {
			var cls = 'bplus-sortable';
			if (self.deviceSortKey === key) cls += self.deviceSortAsc ? ' asc' : ' desc';
			return E('th', {
				'class': cls,
				'click': function () {
					if (self.deviceSortKey === key) self.deviceSortAsc = !self.deviceSortAsc;
					else {
						self.deviceSortKey = key;
						self.deviceSortAsc = false;
					}
					self.renderDevicesTable();
				}
			}, [ label ]);
		}

		var trh = E('tr', {}, [
			sortable('ifindex', 'ifindex'),
			sortable(_('Iface'), 'iface'),
			sortable(_('Subnet'), 'subnet'),
			E('th', {}, [ _('Hostname') ]),
			sortable(_('MAC'), 'mac'),
			E('th', {}, [ 'IPv4' ]),
			E('th', {}, [ 'IPv6' ]),
			sortable(_('Online'), 'online'),
			sortable(_('Neighbor'), 'neighbor'),
			sortable(_('Upload B/s'), 'rate_up'),
			sortable(_('Download B/s'), 'rate_down'),
			sortable(_('Cumulative ↑'), 'cum_up'),
			sortable(_('Cumulative ↓'), 'cum_down'),
			E('th', {}, [ _('Actions') ])
		]);
		head.appendChild(trh);

		var list = this.getSortedDevices();
		var online = 0;
		for (var oi = 0; oi < list.length; oi++) {
			if (list[oi].online) online++;
		}
		if (this.el.devicesCount) {
			this.el.devicesCount.textContent = String(list.length) + ' ' + _('entries') + ' · ' + _('Online') + ' ' + String(online);
		}

		if (!list.length) {
			body.appendChild(E('tr', {}, [ E('td', { 'colspan': '14', 'class': 'bplus-empty' }, [ _('No devices') ]) ]));
			return;
		}

		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			var cum = d.cumulative || {};
			var met = d.metrics || {};
			var cumUp = asNum(cum.up_v4_bytes) + asNum(cum.up_v6_bytes);
			var cumDown = asNum(cum.down_v4_bytes) + asNum(cum.down_v6_bytes);
			var hostDisplay = d.hostname === '-' || d.hostname == null || String(d.hostname).trim() === '' ? '' : String(d.hostname);
			var hostInput = E('input', {
				'type': 'text',
				'class': 'cbi-input-text',
				'value': hostDisplay,
				'placeholder': _('Hostname')
			});
			var onlineCell = d.online ? _('yes') : _('no');
			var tr = E('tr', { 'class': d.online ? 'is-online' : 'is-offline' }, [
				E('td', {}, [ String(d.ifindex != null ? d.ifindex : '') ]),
				E('td', {}, [ d.logical_iface || '—' ]),
				E('td', {}, [ d.subnet || '—' ]),
				E('td', { 'class': 'hostname-cell' }, [ hostInput ]),
				E('td', { 'class': 'bplus-mono' }, [ d.mac || '—' ]),
				E('td', {}, [ (d.ipv4 && d.ipv4.length) ? d.ipv4.join(', ') : '—' ]),
				E('td', {}, [ (d.ipv6 && d.ipv6.length) ? d.ipv6.join(', ') : '—' ]),
				E('td', {}, [ onlineCell ]),
				E('td', {}, [ d.neighbor_state != null ? String(d.neighbor_state) : '—' ]),
				E('td', {}, [ formatBpsAsByteRate(sumUpBps(met)) ]),
				E('td', {}, [ formatBpsAsByteRate(sumDownBps(met)) ]),
				E('td', {}, [ formatBytes(cumUp) ]),
				E('td', {}, [ formatBytes(cumDown) ])
			]);
			var saveBtn = E('button', {
				'class': 'btn cbi-button cbi-button-save',
				'click': L.bind(this.saveDeviceHostname, this, d, hostInput)
			}, [ _('Save') ]);
			var fillBtn = E('button', {
				'class': 'btn cbi-button cbi-button-action',
				'click': L.bind(this.prefillScheduleFromDevice, this, d)
			}, [ _('Use in Schedule') ]);
			tr.appendChild(E('td', {}, [ E('div', { 'class': 'bplus-actions' }, [ saveBtn, fillBtn ]) ]));
			body.appendChild(tr);
		}
	},

	saveDeviceHostname: function (dev, inputEl) {
		var next = String(inputEl.value || '').trim();
		if (!next) {
			this.notifyError(_('Hostname cannot be empty'), null);
			return;
		}
		var payload = {
			iface: dev.logical_iface || '',
			mac: dev.mac,
			hostname: next
		};
		callSetDeviceHostname(payload).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) {
				throw new Error(r.error || 'set hostname failed');
			}
			ui.addNotification(null, E('p', {}, [ _('Hostname updated') ]));
			return this.refreshLive(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to set hostname'), e);
		}, this));
	},

	prefillScheduleFromDevice: function (dev) {
		if (!this.el.schIface || !this.el.schMac) return;
		this.el.schIface.value = dev.logical_iface || this.selectedIface || '';
		this.el.schMac.value = dev.mac || '';
		this.el.scheduleAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
	},

	drawTrendChart: function () {
		var canvas = this.el.trendCanvas;
		var tooltip = this.el.trendTooltip;
		if (!canvas) return;
		var dpr = window.devicePixelRatio || 1;
		var wrap = canvas.parentElement;
		var cw = Math.max(1, (wrap && wrap.offsetWidth) || 600);
		var ch = BPLUS_TREND_CHART_CSS_H;
		canvas.style.width = cw + 'px';
		canvas.style.height = ch + 'px';
		canvas.style.display = 'block';
		canvas.width = Math.max(1, Math.floor(cw * dpr));
		canvas.height = Math.max(1, Math.floor(ch * dpr));
		var ctx = canvas.getContext('2d');
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, cw, ch);

		if (!this.trend.length) {
			ctx.fillStyle = '#7a7a7a';
			ctx.font = '12px sans-serif';
			ctx.fillText(_('No trend data'), 12, 20);
			if (tooltip) tooltip.style.display = 'none';
			canvas.__viewRange = null;
			return;
		}

		var pad = { l: 40, r: 16, t: 16, b: 26 };
		var n = this.trend.length;
		var scale = Math.max(1, Math.min(12, this.chartScale));
		this.chartScale = scale;
		var vis = Math.max(8, Math.floor(n / scale));
		if (vis > n) vis = n;
		var maxStart = Math.max(0, n - vis);
		var start = Math.floor(this.chartOffset * maxStart);
		if (start < 0) start = 0;
		if (start > maxStart) start = maxStart;
		var end = Math.min(n, start + vis);
		canvas.__viewRange = { start: start, end: end };
		var pw = cw - pad.l - pad.r;
		var ph = ch - pad.t - pad.b;

		var rawView = this.trend.slice(start, end);
		var view = rawView;
		if (rawView.length > 0 && pw > 0) {
			var renderCap = Math.max(120, Math.floor(pw * 2));
			if (rawView.length > renderCap) {
				var step = rawView.length / renderCap;
				view = [];
				for (var si = 0; si < renderCap; si++) {
					var src = rawView[Math.floor(si * step)];
					if (src) view.push(src);
				}
				var last = rawView[rawView.length - 1];
				if (last && view[view.length - 1] !== last) view.push(last);
			}
		}
		var maxV = 1;
		for (var i = 0; i < view.length; i++) {
			if (view[i].up > maxV) maxV = view[i].up;
			if (view[i].down > maxV) maxV = view[i].down;
		}

		ctx.strokeStyle = 'rgba(130,130,130,0.28)';
		ctx.lineWidth = 1;
		for (var gy = 0; gy <= 4; gy++) {
			var y = pad.t + (ph * gy / 4);
			ctx.beginPath();
			ctx.moveTo(pad.l, y);
			ctx.lineTo(cw - pad.r, y);
			ctx.stroke();
		}

		ctx.fillStyle = '#8a8a8a';
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'right';
		for (var ty = 0; ty <= 4; ty++) {
			var v = maxV * (1 - ty / 4);
			var y2 = pad.t + (ph * ty / 4) + 4;
			ctx.fillText(formatRate(v), pad.l - 6, y2);
		}

		function toX(i) {
			if (view.length <= 1) return pad.l;
			return pad.l + (i * pw / (view.length - 1));
		}
		function toY(v) {
			return pad.t + ph - (v / maxV) * ph;
		}

		ctx.lineWidth = 2;
		ctx.strokeStyle = '#f97316';
		ctx.beginPath();
		for (var u = 0; u < view.length; u++) {
			var ux = toX(u), uy = toY(view[u].up);
			if (u === 0) ctx.moveTo(ux, uy);
			else ctx.lineTo(ux, uy);
		}
		ctx.stroke();

		ctx.strokeStyle = '#06b6d4';
		ctx.beginPath();
		for (var d = 0; d < view.length; d++) {
			var dx = toX(d), dy = toY(view[d].down);
			if (d === 0) ctx.moveTo(dx, dy);
			else ctx.lineTo(dx, dy);
		}
		ctx.stroke();

		if (typeof this.chartHoverIndex === 'number') {
			var hi = this.chartHoverIndex - start;
			if (hi >= 0 && hi < view.length) {
				var hx = toX(hi);
				ctx.strokeStyle = 'rgba(255,255,255,0.35)';
				ctx.beginPath();
				ctx.moveTo(hx, pad.t);
				ctx.lineTo(hx, ch - pad.b);
				ctx.stroke();
			}
		}

		ctx.fillStyle = '#8a8a8a';
		ctx.textAlign = 'left';
		if (view.length) {
			var s = new Date(view[0].ts_ms);
			var e = new Date(view[view.length - 1].ts_ms);
			ctx.fillText(s.toLocaleTimeString(), pad.l, ch - 8);
			ctx.textAlign = 'right';
			ctx.fillText(e.toLocaleTimeString(), cw - pad.r, ch - 8);
		}
		if (tooltip && typeof this.chartHoverIndex !== 'number') tooltip.style.display = 'none';
	},

	handleTrendMove: function (ev) {
		var canvas = this.el.trendCanvas;
		var tooltip = this.el.trendTooltip;
		if (!canvas || !this.trend.length || !canvas.__viewRange) return;
		var rect = canvas.getBoundingClientRect();
		var x = ev.clientX - rect.left;
		var padL = 40;
		var padR = 16;
		var usable = rect.width - padL - padR;
		if (usable <= 0) return;
		var range = canvas.__viewRange;
		var count = range.end - range.start;
		if (count <= 0) return;
		var rel = (x - padL) / usable;
		if (rel < 0) rel = 0;
		if (rel > 1) rel = 1;
		var idx = range.start + Math.round(rel * (count - 1));
		if (idx < range.start) idx = range.start;
		if (idx >= range.end) idx = range.end - 1;
		this.chartHoverIndex = idx;
		this.drawTrendChart();

		var p = this.trend[idx];
		if (!p || !tooltip) return;
		tooltip.innerHTML =
			'<div class="bplus-tip-title">' + new Date(p.ts_ms).toLocaleString() + '</div>' +
			'<div class="bplus-tip-row"><span>' + _('Upload') + '</span><strong>' + formatRate(p.up) + '</strong></div>' +
			'<div class="bplus-tip-row"><span>' + _('Download') + '</span><strong>' + formatRate(p.down) + '</strong></div>';
		tooltip.style.display = 'block';
		var tw = tooltip.offsetWidth || 220;
		var th = tooltip.offsetHeight || 80;
		var tx = ev.clientX + 18;
		var ty = ev.clientY - th - 14;
		if (tx + tw > window.innerWidth) tx = ev.clientX - tw - 18;
		if (tx < 6) tx = 6;
		if (ty < 6) ty = ev.clientY + 18;
		tooltip.style.left = tx + 'px';
		tooltip.style.top = ty + 'px';
	},

	handleTrendLeave: function () {
		this.chartHoverIndex = null;
		if (this.el.trendTooltip) this.el.trendTooltip.style.display = 'none';
		this.drawTrendChart();
	},

	handleTrendWheel: function (ev) {
		if (!this.trend.length) return;
		ev.preventDefault();
		var old = this.chartScale;
		if (ev.deltaY < 0) this.chartScale = Math.min(12, this.chartScale * 1.2);
		else this.chartScale = Math.max(1, this.chartScale / 1.2);
		if (Math.abs(this.chartScale - old) < 0.0001) return;

		var canvas = this.el.trendCanvas;
		var rect = canvas.getBoundingClientRect();
		var x = ev.clientX - rect.left;
		var ratio = rect.width > 0 ? x / rect.width : 0.5;
		if (ratio < 0) ratio = 0;
		if (ratio > 1) ratio = 1;
		var n = this.trend.length;
		var oldVis = Math.max(8, Math.floor(n / old));
		if (oldVis > n) oldVis = n;
		var oldStart = Math.floor(this.chartOffset * Math.max(0, n - oldVis));
		var focusIndex = oldStart + Math.floor(ratio * Math.max(0, oldVis - 1));
		var newVis = Math.max(8, Math.floor(n / this.chartScale));
		if (newVis > n) newVis = n;
		var newStart = focusIndex - Math.floor(ratio * Math.max(0, newVis - 1));
		if (newStart < 0) newStart = 0;
		if (newStart > n - newVis) newStart = n - newVis;
		this.chartOffset = (n - newVis) > 0 ? (newStart / (n - newVis)) : 0;
		this.drawTrendChart();
	},

	renderPolicyTable: function () {
		var list = this.rate.policy || [];
		dom.content(this.el.policyBody, []);
		if (!list.length) {
			this.el.policyBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '8', 'class': 'bplus-empty' }, [ _('(empty)') ]) ]));
			return;
		}
		for (var i = 0; i < list.length; i++) {
			var x = list[i];
			this.el.policyBody.appendChild(E('tr', {}, [
				E('td', {}, [ x.scope || '—' ]),
				E('td', {}, [ x.iface != null ? String(x.iface) : '—' ]),
				E('td', {}, [ x.mac != null ? String(x.mac) : '—' ]),
				E('td', {}, [ String(x.down_v4_kbps || 0) ]),
				E('td', {}, [ String(x.down_v6_kbps || 0) ]),
				E('td', {}, [ String(x.up_v4_kbps || 0) ]),
				E('td', {}, [ String(x.up_v6_kbps || 0) ]),
				E('td', {}, [ x.extra || '—' ])
			]));
		}
	},

	renderSchedulesTable: function () {
		var self = this;
		var list = this.rate.schedules || [];
		dom.content(this.el.scheduleBody, []);
		if (!list.length) {
			this.el.scheduleBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '7', 'class': 'bplus-empty' }, [ _('(empty)') ]) ]));
			return;
		}
		for (var i = 0; i < list.length; i++) {
			(function (r) {
				var t = r.time_slot || {};
				var ops = E('td', {});
				ops.appendChild(E('button', {
					'class': 'btn cbi-button cbi-button-edit',
					'click': function () { self.editSchedule(r); }
				}, [ _('Edit') ]));
				ops.appendChild(E('button', {
					'class': 'btn cbi-button cbi-button-remove',
					'click': function () { self.deleteSchedule(r.id); }
				}, [ _('Delete') ]));
				self.el.scheduleBody.appendChild(E('tr', {}, [
					E('td', {}, [ String(r.id || '—') ]),
					E('td', {}, [ String(r.iface || '—') ]),
					E('td', {}, [ String(r.mac || '—') ]),
					E('td', {}, [ (t.start || '--:--') + ' - ' + (t.end || '--:--') ]),
					E('td', {}, [ daysText(t.days || []) ]),
					E('td', {}, [ 'd4 ' + (r.down_v4_kbps || 0) + ' / d6 ' + (r.down_v6_kbps || 0) + ' / u4 ' + (r.up_v4_kbps || 0) + ' / u6 ' + (r.up_v6_kbps || 0) ]),
					ops
				]));
			})(list[i]);
		}
	},

	renderIfaceLimitTable: function () {
		var self = this;
		var list = this.rate.ifaceLimits || [];
		dom.content(this.el.ifaceLimitBody, []);
		if (!list.length) {
			this.el.ifaceLimitBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '6', 'class': 'bplus-empty' }, [ _('(empty)') ]) ]));
			return;
		}
		for (var i = 0; i < list.length; i++) {
			(function (it) {
				self.el.ifaceLimitBody.appendChild(E('tr', {}, [
					E('td', {}, [ String(it.iface || '—') ]),
					E('td', {}, [ String(it.down_v4_kbps || 0) ]),
					E('td', {}, [ String(it.down_v6_kbps || 0) ]),
					E('td', {}, [ String(it.up_v4_kbps || 0) ]),
					E('td', {}, [ String(it.up_v6_kbps || 0) ]),
					E('td', {}, [ E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': function () { self.deleteIfaceLimit(it.iface); }
					}, [ _('Delete') ]) ])
				]));
			})(list[i]);
		}
	},

	renderGuestDefaultTable: function () {
		var self = this;
		var list = this.rate.guestDefaults || [];
		dom.content(this.el.guestDefaultBody, []);
		if (!list.length) {
			this.el.guestDefaultBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '6', 'class': 'bplus-empty' }, [ _('(empty)') ]) ]));
			return;
		}
		for (var i = 0; i < list.length; i++) {
			(function (it) {
				self.el.guestDefaultBody.appendChild(E('tr', {}, [
					E('td', {}, [ String(it.iface || '—') ]),
					E('td', {}, [ String(it.down_v4_kbps || 0) ]),
					E('td', {}, [ String(it.down_v6_kbps || 0) ]),
					E('td', {}, [ String(it.up_v4_kbps || 0) ]),
					E('td', {}, [ String(it.up_v6_kbps || 0) ]),
					E('td', {}, [ E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': function () { self.deleteGuestDefault(it.iface); }
					}, [ _('Delete') ]) ])
				]));
			})(list[i]);
		}
	},

	renderWhitelistTable: function () {
		var self = this;
		var list = this.rate.guestWhitelist || [];
		dom.content(this.el.whitelistBody, []);
		if (!list.length) {
			this.el.whitelistBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '3', 'class': 'bplus-empty' }, [ _('(empty)') ]) ]));
			return;
		}
		for (var i = 0; i < list.length; i++) {
			(function (w) {
				self.el.whitelistBody.appendChild(E('tr', {}, [
					E('td', {}, [ String(w.iface || '—') ]),
					E('td', { 'class': 'bplus-mono' }, [ String(w.mac || '—') ]),
					E('td', {}, [ E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': function () { self.removeWhitelist(w); }
					}, [ _('Delete') ]) ])
				]));
			})(list[i]);
		}
	},

	editSchedule: function (r) {
		var t = r.time_slot || {};
		this.scheduleEditingId = String(r.id);
		this.el.schIface.value = r.iface || '';
		this.el.schMac.value = r.mac || '';
		this.el.schStart.value = t.start || '09:00';
		this.el.schEnd.value = t.end || '18:00';
		var daySet = {};
		var daysArr = t.days || [];
		for (var qd = 0; qd < daysArr.length; qd++) {
			daySet[String(daysArr[qd])] = true;
		}
		for (var di = 0; di < this.schDayChecks.length; di++) {
			var num = di + 1;
			this.schDayChecks[di].checked = !!daySet[String(num)];
		}
		this.el.schD4.value = r.down_v4_kbps || 0;
		this.el.schD6.value = r.down_v6_kbps || 0;
		this.el.schU4.value = r.up_v4_kbps || 0;
		this.el.schU6.value = r.up_v6_kbps || 0;
		this.el.schSave.textContent = _('Update schedule');
		this.el.schCancel.style.display = '';
		this.el.scheduleAnchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
	},

	clearScheduleEdit: function () {
		this.scheduleEditingId = null;
		this.el.schSave.textContent = _('Add schedule');
		this.el.schCancel.style.display = 'none';
		for (var di = 0; di < this.schDayChecks.length; di++) {
			this.schDayChecks[di].checked = (di < 5);
		}
	},

	deleteSchedule: function (id) {
		if (!confirm(_('Delete this schedule?'))) return;
		callDeleteSchedule(String(id)).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'delete failed');
			ui.addNotification(null, E('p', {}, [ _('Deleted') ]));
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to delete schedule'), e);
		}, this));
	},

	deleteIfaceLimit: function (iface) {
		if (!iface || !confirm(_('Delete iface limit?'))) return;
		callDeleteIfaceLimit(String(iface)).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'delete failed');
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to delete iface limit'), e);
		}, this));
	},

	deleteGuestDefault: function (iface) {
		if (!iface || !confirm(_('Delete guest default?'))) return;
		callDeleteGuestDefault(String(iface)).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'delete failed');
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to delete guest default'), e);
		}, this));
	},

	removeWhitelist: function (w) {
		if (!confirm(_('Remove this whitelist entry?'))) return;
		callRemoveGuestWhitelist({ iface: w.iface, mac: w.mac }).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'remove failed');
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to remove whitelist entry'), e);
		}, this));
	},

	submitSchedule: function (ev) {
		ev.preventDefault();
		var days = [];
		for (var di = 0; di < this.schDayChecks.length; di++) {
			if (this.schDayChecks[di].checked) days.push(di + 1);
		}
		if (!days.length) {
			this.notifyError(_('Invalid days'), null);
			return;
		}
		var payload = {
			iface: this.el.schIface.value.trim(),
			mac: this.el.schMac.value.trim(),
			time_slot: {
				start: this.el.schStart.value || '00:00',
				end: this.el.schEnd.value || '23:59',
				days: days
			},
			down_v4_kbps: asNum(this.el.schD4.value),
			down_v6_kbps: asNum(this.el.schD6.value),
			up_v4_kbps: asNum(this.el.schU4.value),
			up_v6_kbps: asNum(this.el.schU6.value)
		};
		if (!payload.iface || !payload.mac) {
			this.notifyError(_('Iface and MAC are required'), null);
			return;
		}

		var req = this.scheduleEditingId ?
			callUpdateSchedule([ this.scheduleEditingId, payload ]) :
			callCreateSchedule(payload);

		req.then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'submit failed');
			ui.addNotification(null, E('p', {}, [ this.scheduleEditingId ? _('Schedule updated') : _('Schedule added') ]));
			this.clearScheduleEdit();
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to submit schedule'), e);
		}, this));
	},

	submitIfaceLimit: function (ev) {
		ev.preventDefault();
		var payload = {
			iface: this.el.ifLimitIface.value.trim(),
			down_v4_kbps: asNum(this.el.ifLimitD4.value),
			down_v6_kbps: asNum(this.el.ifLimitD6.value),
			up_v4_kbps: asNum(this.el.ifLimitU4.value),
			up_v6_kbps: asNum(this.el.ifLimitU6.value)
		};
		if (!payload.iface) {
			this.notifyError(_('Iface is required'), null);
			return;
		}
		callSetIfaceLimit(payload).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'set failed');
			ui.addNotification(null, E('p', {}, [ _('Iface limit saved') ]));
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to save iface limit'), e);
		}, this));
	},

	submitGuestDefault: function (ev) {
		ev.preventDefault();
		var payload = {
			iface: this.el.guestDefIface.value.trim(),
			down_v4_kbps: asNum(this.el.guestDefD4.value),
			down_v6_kbps: asNum(this.el.guestDefD6.value),
			up_v4_kbps: asNum(this.el.guestDefU4.value),
			up_v6_kbps: asNum(this.el.guestDefU6.value)
		};
		if (!payload.iface) {
			this.notifyError(_('Iface is required'), null);
			return;
		}
		callSetGuestDefault(payload).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'set failed');
			ui.addNotification(null, E('p', {}, [ _('Guest default saved') ]));
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to save guest default'), e);
		}, this));
	},

	submitWhitelist: function (ev) {
		ev.preventDefault();
		var payload = {
			iface: this.el.wlIface.value.trim(),
			mac: this.el.wlMac.value.trim()
		};
		if (!payload.iface || !payload.mac) {
			this.notifyError(_('Iface and MAC are required'), null);
			return;
		}
		callAddGuestWhitelist(payload).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'add failed');
			ui.addNotification(null, E('p', {}, [ _('Whitelist entry added') ]));
			this.el.wlMac.value = '';
			return this.refreshRateData(false);
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to add whitelist entry'), e);
		}, this));
	},

	syncRateFormIfaceOptions: function () {
		var opts = this.overview.map(function (x) {
			return E('option', { 'value': x.ifname }, [ x.ifname ]);
		});
		var targets = [ this.el.schIfaceList, this.el.ifLimitIfaceList, this.el.guestDefIfaceList, this.el.wlIfaceList ];
		for (var i = 0; i < targets.length; i++) {
			if (!targets[i]) continue;
			dom.content(targets[i], []);
			for (var j = 0; j < opts.length; j++) {
				targets[i].appendChild(E('option', { 'value': opts[j].getAttribute('value') }, [ opts[j].textContent ]));
			}
		}
	},

	collectHistogramTotal: function (buckets) {
		var total = 0;
		for (var i = 0; i < buckets.length; i++) {
			total += asNum(buckets[i].up_v4_bytes) + asNum(buckets[i].up_v6_bytes) + asNum(buckets[i].down_v4_bytes) + asNum(buckets[i].down_v6_bytes);
		}
		return total;
	},

	drawStatsChart: function () {
		var canvas = this.el.statsCanvas;
		if (!canvas) return;
		var data = this.histogram || [];
		var dpr = window.devicePixelRatio || 1;
		var wrap = canvas.parentElement;
		var w = Math.max(1, (wrap && wrap.offsetWidth) || 600);
		var h = BPLUS_STATS_CHART_CSS_H;
		canvas.style.width = w + 'px';
		canvas.style.height = h + 'px';
		canvas.style.display = 'block';
		canvas.width = Math.max(1, Math.floor(w * dpr));
		canvas.height = Math.max(1, Math.floor(h * dpr));
		var ctx = canvas.getContext('2d');
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.scale(dpr, dpr);
		ctx.clearRect(0, 0, w, h);
		if (!data.length) {
			ctx.fillStyle = '#7a7a7a';
			ctx.font = '12px sans-serif';
			ctx.fillText(_('No statistics data'), 12, 20);
			return;
		}
		var pad = { l: 44, r: 16, t: 16, b: 30 };
		var pw = w - pad.l - pad.r;
		var ph = h - pad.t - pad.b;
		var vals = [];
		var maxV = 1;
		for (var i = 0; i < data.length; i++) {
			var v = asNum(data[i].up_v4_bytes) + asNum(data[i].up_v6_bytes) + asNum(data[i].down_v4_bytes) + asNum(data[i].down_v6_bytes);
			vals.push(v);
			if (v > maxV) maxV = v;
		}

		ctx.strokeStyle = 'rgba(130,130,130,0.28)';
		for (var gy = 0; gy <= 4; gy++) {
			var y = pad.t + ph * gy / 4;
			ctx.beginPath();
			ctx.moveTo(pad.l, y);
			ctx.lineTo(w - pad.r, y);
			ctx.stroke();
		}
		ctx.fillStyle = '#8a8a8a';
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'right';
		for (var ty = 0; ty <= 4; ty++) {
			var value = maxV * (1 - ty / 4);
			ctx.fillText(formatBytes(value), pad.l - 6, pad.t + ph * ty / 4 + 4);
		}

		var barW = pw / vals.length;
		ctx.fillStyle = '#28a8b9';
		canvas.__bars = [];
		for (var b = 0; b < vals.length; b++) {
			var bh = maxV > 0 ? ph * vals[b] / maxV : 0;
			var bx = pad.l + b * barW + Math.max(1, barW * 0.12);
			var bw = Math.max(1, barW * 0.76);
			var by = pad.t + ph - bh;
			ctx.fillRect(bx, by, bw, bh);
			canvas.__bars.push({ x: bx, y: by, w: bw, h: bh, index: b, value: vals[b] });
		}

		if (data.length) {
			ctx.fillStyle = '#8a8a8a';
			ctx.textAlign = 'left';
			ctx.fillText(new Date(data[0].start_ts_ms).toLocaleDateString(), pad.l, h - 8);
			ctx.textAlign = 'right';
			ctx.fillText(new Date(data[data.length - 1].start_ts_ms).toLocaleDateString(), w - pad.r, h - 8);
		}
	},

	handleStatsMove: function (ev) {
		var canvas = this.el.statsCanvas;
		var tip = this.el.statsTooltip;
		if (!canvas || !canvas.__bars || !tip) return;
		var rect = canvas.getBoundingClientRect();
		var x = ev.clientX - rect.left;
		var y = ev.clientY - rect.top;
		var bars = canvas.__bars;
		var hit = null;
		for (var i = 0; i < bars.length; i++) {
			var b = bars[i];
			if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
				hit = b;
				break;
			}
		}
		if (!hit) {
			tip.style.display = 'none';
			return;
		}
		var row = this.histogram[hit.index] || {};
		tip.innerHTML =
			'<div class="bplus-tip-title">' + new Date(row.start_ts_ms || 0).toLocaleString() + '</div>' +
			'<div class="bplus-tip-row"><span>' + _('Total') + '</span><strong>' + formatBytes(hit.value) + '</strong></div>' +
			'<div class="bplus-tip-row"><span>' + _('Upload') + '</span><strong>' + formatBytes(sumUpBytes(row)) + '</strong></div>' +
			'<div class="bplus-tip-row"><span>' + _('Download') + '</span><strong>' + formatBytes(sumDownBytes(row)) + '</strong></div>';
		tip.style.display = 'block';
		var tw = tip.offsetWidth || 220;
		var th = tip.offsetHeight || 100;
		var tx = ev.clientX + 18;
		var ty = ev.clientY - th - 14;
		if (tx + tw > window.innerWidth) tx = ev.clientX - tw - 18;
		if (tx < 6) tx = 6;
		if (ty < 6) ty = ev.clientY + 18;
		tip.style.left = tx + 'px';
		tip.style.top = ty + 'px';
	},

	handleStatsLeave: function () {
		if (this.el.statsTooltip) this.el.statsTooltip.style.display = 'none';
	},

	queryStats: function () {
		var iface = this.el.statsIface.value;
		var start = dateStartMs(this.el.statsStart.value);
		var end = dateEndMs(this.el.statsEnd.value);
		var bucket = this.el.statsBucket.value || 'daily';
		if (!iface) {
			this.notifyError(_('Please choose an interface'), null);
			return;
		}
		if (start == null || end == null || end < start) {
			this.notifyError(_('Invalid date range'), null);
			return;
		}

		this.setBusy(this.el.statsQuery, true);
		dom.content(this.el.rankBody, [ E('tr', {}, [ E('td', { 'colspan': '4', 'class': 'bplus-empty' }, [ _('Loading...') ]) ]) ]);

		var macF = this.el.statsMacSelect ? (this.el.statsMacSelect.value || '').trim() : '';
		var tt = this.el.statsTrafficTypeSelect ? (this.el.statsTrafficTypeSelect.value || 'all') : 'all';
		if (tt === 'all') tt = '';

		callGetHistogram(iface, macF, tt || 'all', String(start), String(end), bucket)
			.then(function (r) { return unwrapData(r, []); })
			.then(L.bind(function (hist) {
				this.histogram = hist || [];
				this.drawStatsChart();
				if (this.el.histogramCount) {
					this.el.histogramCount.textContent = String((this.histogram || []).length) + ' ' + _('entries');
				}
				return callGetDevices(iface, '').then(function (r) { return unwrapData(r, []); });
			}, this))
			.then(L.bind(function (devices) {
				var self = this;
				var list = devices || [];
				return mapLimit(list, 8, function (dev) {
					return callGetHistogram(iface, dev.mac, tt || 'all', String(start), String(end), 'daily')
						.then(function (r) { return unwrapData(r, []); })
						.then(function (b) {
							return {
								dev: dev,
								total: self.collectHistogramTotal(b || [])
							};
						}).catch(function () {
							return { dev: dev, total: 0 };
						});
				});
			}, this))
			.then(L.bind(function (items) {
				items.sort(function (a, b) { return b.total - a.total; });
				dom.content(this.el.rankBody, []);
				if (!items.length) {
					this.el.rankBody.appendChild(E('tr', {}, [ E('td', { 'colspan': '4', 'class': 'bplus-empty' }, [ _('No data') ]) ]));
					return;
				}
				var top = items.slice(0, 20);
				for (var i = 0; i < top.length; i++) {
					var d = top[i].dev || {};
					this.el.rankBody.appendChild(E('tr', {}, [
						E('td', {}, [ String(i + 1) ]),
						E('td', {}, [ (d.hostname || '—') + ' / ' + (d.mac || '—') ]),
						E('td', {}, [ d.logical_iface || '—' ]),
						E('td', {}, [ formatBytes(top[i].total) ])
					]));
				}
			}, this))
			.catch(L.bind(function (e) {
				this.notifyError(_('Failed to query statistics'), e);
				dom.content(this.el.rankBody, [ E('tr', {}, [ E('td', { 'colspan': '4', 'class': 'bplus-empty' }, [ _('Failed') ]) ]) ]);
			}, this))
			.then(L.bind(function () {
				this.setBusy(this.el.statsQuery, false);
			}, this), L.bind(function () {
				this.setBusy(this.el.statsQuery, false);
			}, this));
	},

	applyStatsPreset: function (kind) {
		var now = new Date();
		var start, end;
		if (kind === 'today') {
			start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
			end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		}
		else if (kind === 'week') {
			start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
			end = now;
		}
		else if (kind === 'month') {
			start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
			end = now;
		}
		else if (kind === 'year') {
			start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1);
			end = now;
		}
		else {
			return;
		}
		this.el.statsStart.value = start.toISOString().slice(0, 10);
		this.el.statsEnd.value = end.toISOString().slice(0, 10);
	},

	bindEvents: function () {
		this.el.periodSelect.addEventListener('change', L.bind(function () {
			this.period = this.el.periodSelect.value;
			localStorage.setItem('bplus_period', this.period);
			this.refreshLive(true);
		}, this));

		this.el.ifaceSelect.addEventListener('change', L.bind(function () {
			this.selectedIface = this.el.ifaceSelect.value;
			this.renderTrendDeviceOptions();
			this.refreshTrend(true);
		}, this));

		this.el.trendDeviceSelect.addEventListener('change', L.bind(function () {
			this.selectedTrendMac = this.el.trendDeviceSelect.value || '';
			this.refreshTrend(true);
		}, this));

		this.el.trendTypeSelect.addEventListener('change', L.bind(function () {
			this.selectedTrendType = this.el.trendTypeSelect.value;
			this.refreshTrend(true);
		}, this));

		if (this.el.trendDirectionSelect) {
			this.el.trendDirectionSelect.addEventListener('change', L.bind(function () {
				this.selectedTrendDirection = this.el.trendDirectionSelect.value || '';
				this.refreshTrend(true);
			}, this));
		}

		if (this.el.devicesIfaceSelect) {
			this.el.devicesIfaceSelect.addEventListener('change', L.bind(function () {
				this.devicesFilterIface = this.el.devicesIfaceSelect.value || '';
				this.refreshLive(true);
			}, this));
		}
		if (this.el.devicesFilterResetBtn) {
			this.el.devicesFilterResetBtn.addEventListener('click', L.bind(function () {
				this.devicesFilterIface = '';
				if (this.el.devicesIfaceSelect) this.el.devicesIfaceSelect.value = '';
				this.refreshLive(true);
			}, this));
		}

		if (this.el.statsIface) {
			this.el.statsIface.addEventListener('change', L.bind(function () {
				this.renderStatsMacOptions();
			}, this));
		}

		this.el.trendCanvas.addEventListener('mousemove', L.bind(this.handleTrendMove, this));
		this.el.trendCanvas.addEventListener('mouseleave', L.bind(this.handleTrendLeave, this));
		this.el.trendCanvas.addEventListener('wheel', L.bind(this.handleTrendWheel, this), { passive: false });

		window.addEventListener('resize', L.bind(function () {
			this.drawTrendChart();
			this.drawStatsChart();
		}, this));

		this.el.scheduleForm.addEventListener('submit', L.bind(this.submitSchedule, this));
		this.el.schCancel.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.clearScheduleEdit();
		}, this));
		this.el.ifaceLimitForm.addEventListener('submit', L.bind(this.submitIfaceLimit, this));
		this.el.guestDefaultForm.addEventListener('submit', L.bind(this.submitGuestDefault, this));
		this.el.whitelistForm.addEventListener('submit', L.bind(this.submitWhitelist, this));

		this.el.statsQuery.addEventListener('click', L.bind(this.queryStats, this));
		this.el.presetToday.addEventListener('click', L.bind(function () { this.applyStatsPreset('today'); }, this));
		this.el.presetWeek.addEventListener('click', L.bind(function () { this.applyStatsPreset('week'); }, this));
		this.el.presetMonth.addEventListener('click', L.bind(function () { this.applyStatsPreset('month'); }, this));
		this.el.presetYear.addEventListener('click', L.bind(function () { this.applyStatsPreset('year'); }, this));

		this.el.statsCanvas.addEventListener('mousemove', L.bind(this.handleStatsMove, this));
		this.el.statsCanvas.addEventListener('mouseleave', L.bind(this.handleStatsLeave, this));
	},

	buildView: function () {
		this.el = {};
		this.el.periodSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'today' }, [ _('Today') ]),
			E('option', { 'value': 'week' }, [ _('This Week') ]),
			E('option', { 'value': 'month' }, [ _('This Month') ]),
			E('option', { 'value': 'year' }, [ _('This Year') ])
		]);
		this.el.periodSelect.value = this.period;

		this.el.ifaceSelect = E('select', { 'class': 'cbi-input-select' });
		this.el.trendDeviceSelect = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '' }, [ _('All Devices') ]) ]);
		this.el.trendTypeSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'ipv4' }, [ 'IPv4' ]),
			E('option', { 'value': 'ipv6' }, [ 'IPv6' ])
		]);
		this.el.overviewGrid = E('div', { 'class': 'overview-grid', 'id': 'bplus-overview-grid' });
		this.el.overviewCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-overview-count' }, [ '0 条' ]);

		this.el.devicesIfaceSelect = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '' }, [ _('All interfaces') ]) ]);
		this.el.devicesFilterResetBtn = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-neutral' }, [ _('Reset') ]);
		this.el.devicesCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-devices-count' }, [ '0 ' + _('entries') ]);

		this.el.trendDirectionSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': '' }, [ 'both' ]),
			E('option', { 'value': 'up' }, [ 'up' ]),
			E('option', { 'value': 'down' }, [ 'down' ])
		]);
		this.el.trendDirectionSelect.value = this.selectedTrendDirection || '';
		this.el.trendCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-trend-count' }, [ '0 ' + _('entries') ]);

		this.el.trendCanvas = E('canvas', { 'class': 'bplus-chart-canvas' });
		this.el.trendTooltip = E('div', { 'class': 'bplus-tooltip' });
		this.el.deviceHead = E('thead');
		this.el.deviceBody = E('tbody');

		this.el.policyBody = E('tbody');
		this.el.scheduleBody = E('tbody');
		this.el.ifaceLimitBody = E('tbody');
		this.el.guestDefaultBody = E('tbody');
		this.el.whitelistBody = E('tbody');

		this.el.scheduleAnchor = E('div');
		this.el.schIfaceList = E('datalist', { 'id': 'bplus_sch_iface_list' });
		this.el.ifLimitIfaceList = E('datalist', { 'id': 'bplus_iflimit_iface_list' });
		this.el.guestDefIfaceList = E('datalist', { 'id': 'bplus_guest_iface_list' });
		this.el.wlIfaceList = E('datalist', { 'id': 'bplus_wl_iface_list' });

		this.el.schIface = E('input', { 'class': 'cbi-input-text', 'list': 'bplus_sch_iface_list', 'placeholder': 'eth0' });
		this.el.schMac = E('input', { 'class': 'cbi-input-text bplus-mono', 'placeholder': 'aa:bb:cc:dd:ee:ff' });
		this.el.schStart = E('input', { 'class': 'cbi-input-text', 'type': 'time', 'value': '09:00' });
		this.el.schEnd = E('input', { 'class': 'cbi-input-text', 'type': 'time', 'value': '18:00' });
		this.el.schD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '100' });
		this.el.schD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '100' });
		this.el.schU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '100' });
		this.el.schU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '100' });
		this.el.schSave = E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Add schedule') ]);
		this.el.schCancel = E('button', { 'class': 'btn cbi-button cbi-button-reset', 'type': 'button', 'style': 'display:none;' }, [ _('Cancel edit') ]);

		this.schDayChecks = [];
		var daysRow = E('div', { 'class': 'days-row' });
		for (var dnx = 1; dnx <= 7; dnx++) {
			var cb = E('input', { 'type': 'checkbox', 'value': String(dnx) });
			if (dnx <= 5) cb.checked = true;
			this.schDayChecks.push(cb);
			daysRow.appendChild(E('label', {}, [ cb, ' ' + String(dnx) ]));
		}

		this.el.scheduleForm = E('form', { 'class': 'form-grid' }, [
			E('label', { 'class': 'field' }, [ _('Iface'), this.el.schIface ]),
			E('label', { 'class': 'field' }, [ 'MAC', this.el.schMac ]),
			E('label', { 'class': 'field' }, [ _('Start'), this.el.schStart ]),
			E('label', { 'class': 'field' }, [ _('End'), this.el.schEnd ]),
			E('div', { 'class': 'field field-wide' }, [
				E('span', {}, [ _('Effective days (1–7)') ]),
				daysRow
			]),
			E('label', { 'class': 'field' }, [ 'down v4 (MB/s)', this.el.schD4 ]),
			E('label', { 'class': 'field' }, [ 'down v6 (MB/s)', this.el.schD6 ]),
			E('label', { 'class': 'field' }, [ 'up v4 (MB/s)', this.el.schU4 ]),
			E('label', { 'class': 'field' }, [ 'up v6 (MB/s)', this.el.schU6 ]),
			E('div', { 'class': 'actions-row field-wide' }, [ this.el.schSave, this.el.schCancel ])
		]);

		this.el.ifLimitIface = E('input', { 'class': 'cbi-input-text', 'list': 'bplus_iflimit_iface_list', 'placeholder': 'eth0' });
		this.el.ifLimitD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.ifLimitD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.ifLimitU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.ifLimitU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.ifaceLimitForm = E('form', { 'class': 'form-grid' }, [
			E('label', { 'class': 'field' }, [ _('Iface'), this.el.ifLimitIface ]),
			E('label', { 'class': 'field' }, [ 'down v4 (MB/s)', this.el.ifLimitD4 ]),
			E('label', { 'class': 'field' }, [ 'down v6 (MB/s)', this.el.ifLimitD6 ]),
			E('label', { 'class': 'field' }, [ 'up v4 (MB/s)', this.el.ifLimitU4 ]),
			E('label', { 'class': 'field' }, [ 'up v6 (MB/s)', this.el.ifLimitU6 ]),
			E('div', { 'class': 'actions-row field-wide' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Save iface limit') ])
			])
		]);

		this.el.guestDefIface = E('input', { 'class': 'cbi-input-text', 'list': 'bplus_guest_iface_list', 'placeholder': 'eth0' });
		this.el.guestDefD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.guestDefD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.guestDefU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.guestDefU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'value': '0' });
		this.el.guestDefaultForm = E('form', { 'class': 'form-grid' }, [
			E('label', { 'class': 'field' }, [ _('Iface'), this.el.guestDefIface ]),
			E('label', { 'class': 'field' }, [ 'down v4 (MB/s)', this.el.guestDefD4 ]),
			E('label', { 'class': 'field' }, [ 'down v6 (MB/s)', this.el.guestDefD6 ]),
			E('label', { 'class': 'field' }, [ 'up v4 (MB/s)', this.el.guestDefU4 ]),
			E('label', { 'class': 'field' }, [ 'up v6 (MB/s)', this.el.guestDefU6 ]),
			E('div', { 'class': 'actions-row field-wide' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Save guest default') ])
			])
		]);

		this.el.wlIface = E('input', { 'class': 'cbi-input-text', 'list': 'bplus_wl_iface_list', 'placeholder': 'eth0' });
		this.el.wlMac = E('input', { 'class': 'cbi-input-text bplus-mono', 'placeholder': 'aa:bb:cc:dd:ee:ff' });
		this.el.whitelistForm = E('form', { 'class': 'form-grid' }, [
			E('label', { 'class': 'field' }, [ _('Iface'), this.el.wlIface ]),
			E('label', { 'class': 'field' }, [ 'MAC', this.el.wlMac ]),
			E('div', { 'class': 'actions-row field-wide' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Add whitelist') ])
			])
		]);

		this.el.statsIface = E('select', { 'class': 'cbi-input-select' });
		this.el.statsStart = E('input', { 'class': 'cbi-input-text', 'type': 'date' });
		this.el.statsEnd = E('input', { 'class': 'cbi-input-text', 'type': 'date' });
		this.el.statsBucket = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'hourly' }, [ _('Hourly') ]),
			E('option', { 'value': 'daily' }, [ _('Daily') ])
		]);
		this.el.statsBucket.value = 'daily';
		this.el.statsQuery = E('button', { 'class': 'btn cbi-button cbi-button-action', 'type': 'button' }, [ _('Query') ]);
		this.el.presetToday = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'type': 'button' }, [ _('Today') ]);
		this.el.presetWeek = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'type': 'button' }, [ _('Last 7 Days') ]);
		this.el.presetMonth = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'type': 'button' }, [ _('Last 30 Days') ]);
		this.el.presetYear = E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'type': 'button' }, [ _('Last Year') ]);
		this.el.statsCanvas = E('canvas', { 'class': 'bplus-chart-canvas bplus-stats-chart' });
		this.el.statsTooltip = E('div', { 'class': 'bplus-tooltip' });
		this.el.rankBody = E('tbody');
		this.el.statsMacSelect = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '' }, [ _('All devices') ]) ]);
		this.el.statsTrafficTypeSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'ipv4' }, [ 'IPv4' ]),
			E('option', { 'value': 'ipv6' }, [ 'IPv6' ])
		]);
		this.el.histogramCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-histogram-count' }, [ '0 ' + _('entries') ]);

		var now = new Date();
		var from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
		this.el.statsStart.value = from.toISOString().slice(0, 10);
		this.el.statsEnd.value = now.toISOString().slice(0, 10);
		this.el.trendTypeSelect.value = this.selectedTrendType;

		this.root = E('div', { 'class': 'bplus-page' }, [
			E('div', { 'class': 'bplus-main' }, [
				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', [ '接口总览' ]),
						this.el.overviewCount
					]),
					this.el.overviewGrid
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', {}, [ _('Devices') ]),
						this.el.devicesCount
					]),
					E('div', { 'class': 'bplus-inline-form' }, [
						E('label', {}, [ _('Iface filter'), this.el.devicesIfaceSelect ]),
						E('label', {}, [ _('Period'), this.el.periodSelect ]),
						this.el.devicesFilterResetBtn
					]),
					E('div', { 'class': 'table-wrapper' }, [ E('table', { 'class': 'table bplus-table' }, [ this.el.deviceHead, this.el.deviceBody ]) ])
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-trend-title-row' }, [
						E('div', { 'class': 'bplus-panel-head', 'style': 'margin:0;flex:1' }, [
							E('h2', {}, [ _('Trend samples') ]),
							this.el.trendCount
						]),
						E('div', { 'class': 'bplus-trend-legend' }, [
							E('div', { 'class': 'bplus-legend-item' }, [
								E('span', { 'class': 'bplus-legend-dot bplus-legend-up' }),
								' ',
								_('Upload')
							]),
							E('div', { 'class': 'bplus-legend-item' }, [
								E('span', { 'class': 'bplus-legend-dot bplus-legend-down' }),
								' ',
								_('Download')
							])
						])
					]),
					E('div', { 'class': 'bplus-inline-form bplus-trend-controls' }, [
						E('label', {}, [ _('Iface'), this.el.ifaceSelect ]),
						E('label', {}, [ _('Device MAC'), this.el.trendDeviceSelect ]),
						E('label', {}, [ 'traffic_type', this.el.trendTypeSelect ]),
						E('label', {}, [ 'direction', this.el.trendDirectionSelect ])
					]),
					E('div', { 'class': 'bplus-chart-wrap' }, [ this.el.trendCanvas, this.el.trendTooltip ]),
					E('p', { 'class': 'chart-hint' }, [ _('Y axis: B/s (bps÷8). Wheel zooms; hover for values.') ])
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', {}, [ _('Histogram') ]),
						this.el.histogramCount
					]),
					E('div', { 'class': 'bplus-stats-query-wrap' }, [
						E('label', {}, [ _('Iface'), this.el.statsIface ]),
						E('label', {}, [ _('Device MAC'), this.el.statsMacSelect ]),
						E('label', {}, [ 'traffic_type', this.el.statsTrafficTypeSelect ]),
						E('label', {}, [ _('Start'), this.el.statsStart ]),
						E('label', {}, [ _('End'), this.el.statsEnd ]),
						E('label', {}, [ 'bucket', this.el.statsBucket ]),
						this.el.statsQuery,
						this.el.presetToday,
						this.el.presetWeek,
						this.el.presetMonth,
						this.el.presetYear
					]),
					E('div', { 'class': 'bplus-chart-wrap' }, [ this.el.statsCanvas, this.el.statsTooltip ]),
					E('h4', {}, [ _('Top device ranking') ]),
					E('div', { 'class': 'table-wrapper' }, [
						E('table', { 'class': 'table bplus-table' }, [
							E('thead', {}, [ E('tr', {}, [ E('th', {}, [ '#' ]), E('th', {}, [ _('Device') ]), E('th', {}, [ _('Iface') ]), E('th', {}, [ _('Traffic') ]) ]) ]),
							this.el.rankBody
						])
					])
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', {}, [ _('Rate limit') ]),
						E('span', { 'class': 'meta-pill' }, [ _('Write operations') ])
					]),
					E('div', { 'class': 'policy-grid' }, [
						E('article', { 'class': 'policy-card' }, [
							E('h3', {}, [ _('Policy (read-only)') ]),
							E('div', { 'class': 'table-wrapper' }, [
								E('table', { 'class': 'table bplus-table' }, [
									E('thead', {}, [ E('tr', {}, [ E('th', {}, [ 'scope' ]), E('th', {}, [ 'iface' ]), E('th', {}, [ 'mac' ]), E('th', {}, [ 'd4' ]), E('th', {}, [ 'd6' ]), E('th', {}, [ 'u4' ]), E('th', {}, [ 'u6' ]), E('th', {}, [ 'extra' ]) ]) ]),
									this.el.policyBody
								])
							])
						]),
						E('article', { 'class': 'policy-card' }, [
							E('h3', {}, [ 'Schedules' ]),
							this.el.scheduleAnchor,
							this.el.schIfaceList,
							this.el.scheduleForm,
							E('div', { 'class': 'table-wrapper compact' }, [
								E('table', { 'class': 'table bplus-table' }, [
									E('thead', {}, [ E('tr', {}, [ E('th', {}, [ 'id' ]), E('th', {}, [ 'iface' ]), E('th', {}, [ 'mac' ]), E('th', {}, [ 'time' ]), E('th', {}, [ 'days' ]), E('th', {}, [ _('limits') ]), E('th', {}, [ _('actions') ]) ]) ]),
									this.el.scheduleBody
								])
							])
						]),
						E('article', { 'class': 'policy-card' }, [
							E('h3', {}, [ 'Iface limits' ]),
							this.el.ifLimitIfaceList,
							this.el.ifaceLimitForm,
							E('div', { 'class': 'table-wrapper compact' }, [
								E('table', { 'class': 'table bplus-table' }, [
									E('thead', {}, [ E('tr', {}, [ E('th', {}, [ 'iface' ]), E('th', {}, [ 'd4' ]), E('th', {}, [ 'd6' ]), E('th', {}, [ 'u4' ]), E('th', {}, [ 'u6' ]), E('th', {}, [ _('actions') ]) ]) ]),
									this.el.ifaceLimitBody
								])
							])
						]),
						E('article', { 'class': 'policy-card' }, [
							E('h3', {}, [ 'Guest defaults' ]),
							this.el.guestDefIfaceList,
							this.el.guestDefaultForm,
							E('div', { 'class': 'table-wrapper compact' }, [
								E('table', { 'class': 'table bplus-table' }, [
									E('thead', {}, [ E('tr', {}, [ E('th', {}, [ 'iface' ]), E('th', {}, [ 'd4' ]), E('th', {}, [ 'd6' ]), E('th', {}, [ 'u4' ]), E('th', {}, [ 'u6' ]), E('th', {}, [ _('actions') ]) ]) ]),
									this.el.guestDefaultBody
								])
							])
						]),
						E('article', { 'class': 'policy-card' }, [
							E('h3', {}, [ 'Guest whitelist' ]),
							this.el.wlIfaceList,
							this.el.whitelistForm,
							E('div', { 'class': 'table-wrapper compact' }, [
								E('table', { 'class': 'table bplus-table' }, [
									E('thead', {}, [ E('tr', {}, [ E('th', {}, [ 'iface' ]), E('th', {}, [ 'mac' ]), E('th', {}, [ _('actions') ]) ]) ]),
									this.el.whitelistBody
								])
							])
						])
					])
				])
			])
		]);

		return this.root;
	},

	render: function (load) {
		ensureCss();
		this.initState(load);
		var viewNode = this.buildView();
		this.setThemeClass();
		this.bindEvents();

		this.refreshLive(false).then(L.bind(function () {
			if (this.el.statsIface && this.el.statsIface.value) this.queryStats();
		}, this));
		this.refreshRateData(false);
		this.applyStatsPreset('month');

		poll.add(L.bind(function () {
			this.setThemeClass();
			return Promise.all([
				this.refreshLive(false),
				this.refreshRateData(false)
			]);
		}, this), 1);

		return viewNode;
	}
});
