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

var callGetUsageRanking = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'getUsageRanking',
	params: [ 'iface', 'traffic_type', 'start_ms', 'end_ms', 'limit' ],
	expect: {}
});

var callGetSchedules = rpc.declare({ object: 'luci.bandix_plus', method: 'getSchedules', expect: {} });
var callCreateSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'createSchedule', params: [ 'payload' ], expect: {} });
var callUpdateSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'updateSchedule', params: [ 'pair' ], expect: {} });
var callDeleteSchedule = rpc.declare({ object: 'luci.bandix_plus', method: 'deleteSchedule', params: [ 'id' ], expect: {} });
var callSetDeviceHostname = rpc.declare({
	object: 'luci.bandix_plus',
	method: 'setDeviceHostname',
	params: [ 'iface', 'mac', 'hostname' ],
	expect: {}
});
var callGetIfaceLimits = rpc.declare({ object: 'luci.bandix_plus', method: 'getIfaceLimits', expect: {} });
var callSetIfaceLimit = rpc.declare({ object: 'luci.bandix_plus', method: 'setIfaceLimit', params: [ 'payload' ], expect: {} });
var callDeleteIfaceLimit = rpc.declare({ object: 'luci.bandix_plus', method: 'deleteIfaceLimit', params: [ 'iface' ], expect: {} });
var callGetGuestDefaults = rpc.declare({ object: 'luci.bandix_plus', method: 'getGuestDefaults', expect: {} });
var callSetGuestDefault = rpc.declare({ object: 'luci.bandix_plus', method: 'setGuestDefault', params: [ 'payload' ], expect: {} });
var callSetGuestDefaultEnabled = rpc.declare({ object: 'luci.bandix_plus', method: 'setGuestDefaultEnabled', params: [ 'payload' ], expect: {} });
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

var BPLUS_RATE_UNIT_MODE = 'byte';

function setRateUnitMode(mode) {
	BPLUS_RATE_UNIT_MODE = mode === 'bit' ? 'bit' : 'byte';
}

function formatByteRate(n) {
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

function formatByteRateDecimal(n) {
	n = asNum(n);
	if (n <= 0) return '0 B/s';
	var u = [ 'B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s' ];
	var i = 0;
	while (n >= 1000 && i < u.length - 1) {
		n /= 1000;
		i++;
	}
	return (i === 0 ? String(Math.round(n)) : n.toFixed(2)) + ' ' + u[i];
}

function formatBitRate(n) {
	n = asNum(n);
	if (n <= 0) return '0 bps';
	var u = [ 'bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps' ];
	var i = 0;
	while (n >= 1000 && i < u.length - 1) {
		n /= 1000;
		i++;
	}
	return (i === 0 ? String(Math.round(n)) : n.toFixed(2)) + ' ' + u[i];
}

/** Input is byte/s, output follows global unit mode. */
function formatRate(n) {
	var bytesPerSec = asNum(n);
	if (BPLUS_RATE_UNIT_MODE === 'bit')
		return formatBitRate(bytesPerSec * 8);
	return formatByteRate(bytesPerSec);
}

/** Input is bps, output follows global unit mode. */
function formatBpsAsByteRate(bps) {
	var bitsPerSec = asNum(bps);
	if (BPLUS_RATE_UNIT_MODE === 'bit')
		return formatBitRate(bitsPerSec);
	return formatByteRate(bitsPerSec / 8);
}

function formatLimitKbpsValue(v) {
	var n = asNum(v);
	return n > 0 ? String(Math.round(n)) : _('Unlimited');
}

/** Input is kbps limit, output follows global unit mode. */
function formatLimitKbpsRate(v) {
	var n = asNum(v);
	if (n <= 0) return _('Unlimited');
	if (BPLUS_RATE_UNIT_MODE === 'bit')
		return formatBitRate(n * 1000);
	return formatByteRateDecimal((n * 1000) / 8);
}

function getRateLimitUnitChoices(mode) {
	if (mode === 'bit') {
		return [
			{ key: 'k', label: 'Kbps', kbps_factor: 1 },
			{ key: 'm', label: 'Mbps', kbps_factor: 1000 },
			{ key: 'g', label: 'Gbps', kbps_factor: 1000000 }
		];
	}
	return [
		{ key: 'k', label: 'KB/s', kbps_factor: 8 },
		{ key: 'm', label: 'MB/s', kbps_factor: 8000 },
		{ key: 'g', label: 'GB/s', kbps_factor: 8000000 }
	];
}

function pickRateLimitUnitChoice(mode, key) {
	var want = String(key || 'm').toLowerCase();
	var list = getRateLimitUnitChoices(mode);
	for (var i = 0; i < list.length; i++) {
		if (list[i].key === want)
			return list[i];
	}
	return list[1] || list[0];
}

function formatRateLimitInputNumber(n) {
	var v = asNum(n);
	if (!isFinite(v) || v <= 0) return '0';
	var rounded = Math.round(v * 100) / 100;
	return String(rounded);
}

/** 设备 last_seen_ms（Unix 毫秒）→ 本地时间字符串；无效为 — */
function formatDeviceLastSeenMs(ms) {
	var n = asNum(ms);
	if (n <= 0) return '—';
	return new Date(n).toLocaleString();
}

function compareVal(a, b) {
	if (a === b) return 0;
	if (a == null) return -1;
	if (b == null) return 1;
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	return String(a).localeCompare(String(b));
}

function hasSameSelectOptions(sel, rows) {
	if (!sel) return false;
	var opts = sel.options || [];
	if (opts.length !== rows.length) return false;
	for (var i = 0; i < rows.length; i++) {
		var opt = opts[i];
		var row = rows[i];
		if (!opt || !row) return false;
		if (String(opt.value) !== String(row.value)) return false;
		if (String(opt.textContent || '') !== String(row.label || '')) return false;
	}
	return true;
}

function deviceIfaceName(d) {
	if (!d || typeof d !== 'object') return '';
	var v = d.logical_iface != null ? String(d.logical_iface).trim() : '';
	if (v) return v;
	v = d.iface != null ? String(d.iface).trim() : '';
	if (v) return v;
	v = d.ifname != null ? String(d.ifname).trim() : '';
	return v || '';
}

/** 设备列表 IPv4 排序：取第一个地址，按四段数值比较；无/无效为 -1。 */
function deviceFirstIpv4Uint(d) {
	var arr = d && d.ipv4;
	if (!arr || !arr.length) return -1;
	var raw = String(arr[0]).split('/')[0].trim();
	var parts = raw.split('.');
	if (parts.length !== 4) return -1;
	var n = 0;
	for (var i = 0; i < 4; i++) {
		var o = parseInt(parts[i], 10);
		if (isNaN(o) || o < 0 || o > 255) return -1;
		n = ((n << 8) >>> 0) + o;
	}
	return n >>> 0;
}

/** 设备表：简易=合计一行；详细=合计 + IPv4/IPv6 子行 */
function deviceTableRateTd(met, upload, detailed) {
	var v4 = upload ? asNum(met.up_v4_bps) : asNum(met.down_v4_bps);
	var v6 = upload ? asNum(met.up_v6_bps) : asNum(met.down_v6_bps);
	var total = v4 + v6;
	if (!detailed)
		return E('td', {}, [ formatBpsAsByteRate(total) ]);
	return E('td', { 'class': 'bplus-device-td-stacked' }, [
		E('div', { 'class': 'bplus-device-metric-stack' }, [
			E('div', { 'class': 'bplus-device-metric-total' }, [ formatBpsAsByteRate(total) ]),
			E('div', { 'class': 'bplus-device-metric-sub' }, [
				E('span', { 'class': 'bplus-device-metric-v4' }, [ 'IPv4 ' + formatBpsAsByteRate(v4) ]),
				E('span', { 'class': 'bplus-device-metric-v6' }, [ 'IPv6 ' + formatBpsAsByteRate(v6) ])
			])
		])
	]);
}

function deviceTableBytesTd(cum, upload, detailed) {
	var v4b = upload ? asNum(cum.up_v4_bytes) : asNum(cum.down_v4_bytes);
	var v6b = upload ? asNum(cum.up_v6_bytes) : asNum(cum.down_v6_bytes);
	var tot = v4b + v6b;
	if (!detailed)
		return E('td', {}, [ formatBytes(tot) ]);
	return E('td', { 'class': 'bplus-device-td-stacked' }, [
		E('div', { 'class': 'bplus-device-metric-stack' }, [
			E('div', { 'class': 'bplus-device-metric-total' }, [ formatBytes(tot) ]),
			E('div', { 'class': 'bplus-device-metric-sub' }, [
				E('span', { 'class': 'bplus-device-metric-v4' }, [ 'IPv4 ' + formatBytes(v4b) ]),
				E('span', { 'class': 'bplus-device-metric-v6' }, [ 'IPv6 ' + formatBytes(v6b) ])
			])
		])
	]);
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

function formatDateInput(d) {
	var year = d.getFullYear();
	var month = (d.getMonth() + 1).toString().padStart(2, '0');
	var day = d.getDate().toString().padStart(2, '0');
	return year + '-' + month + '-' + day;
}

function formatSlashDateTimeRange(startMs, endMs) {
	var s = new Date(startMs);
	var e = new Date(endMs);
	function slash(x) {
		return x.getFullYear() + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + String(x.getDate()).padStart(2, '0');
	}
	return slash(s) + ' 00:00 - ' + slash(e) + ' 23:59';
}

/**
 * Same as luci-app-bandix `formatTimeRange(startMs, endMs)` (traffic-increments header / timerange):
 * always `YYYY/MM/DD HH:mm - YYYY/MM/DD HH:mm` from local wall time.
 */
function formatStatsHistTooltipTimeRange(startMs, endMs) {
	if (startMs == null || endMs == null) return '';
	var startDate = new Date(asNum(startMs));
	var endDate = new Date(asNum(endMs));
	function formatDateTime(date) {
		var year = date.getFullYear();
		var month = (date.getMonth() + 1).toString().padStart(2, '0');
		var day = date.getDate().toString().padStart(2, '0');
		var hours = date.getHours().toString().padStart(2, '0');
		var minutes = date.getMinutes().toString().padStart(2, '0');
		return year + '/' + month + '/' + day + ' ' + hours + ':' + minutes;
	}
	return formatDateTime(startDate) + ' - ' + formatDateTime(endDate);
}

/** luci-app-bandix `msToTimeLabel`: wall time HH:mm:ss (history realtime tooltip title). */
function msToTimeLabel(tsMs) {
	var d = new Date(asNum(tsMs));
	return d.getHours().toString().padStart(2, '0') + ':' +
		d.getMinutes().toString().padStart(2, '0') + ':' +
		d.getSeconds().toString().padStart(2, '0');
}

function formatEntriesPillText(n) {
	return String(Math.max(0, asNum(n))) + ' ' + _('entries');
}

function formatScheduleDayLabels(days) {
	if (!days || !days.length) return '—';
	var labels = [ '', _('Mon'), _('Tue'), _('Wed'), _('Thu'), _('Fri'), _('Sat'), _('Sun') ];
	var parts = [];
	for (var i = 0; i < days.length; i++) {
		var d = asNum(days[i]);
		parts.push(labels[d] || String(days[i]));
	}
	return parts.join(', ');
}

/** Scheduled rule kbps limits: IPv4/IPv6 × download/upload (same semantics as form). */
function scheduleRuleLimitsEl(r) {
	var d4 = r.down_v4_kbps || 0, d6 = r.down_v6_kbps || 0, u4 = r.up_v4_kbps || 0, u6 = r.up_v6_kbps || 0;
	var line = function (fam, dn, up) {
		return E('div', { 'class': 'bplus-schedule-limit-line' }, [
			fam + ': ' + _('Download') + ' ' + formatLimitKbpsRate(dn) + ', ' + _('Upload') + ' ' + formatLimitKbpsRate(up)
		]);
	};
	return E('div', { 'class': 'bplus-schedule-rule-limits bplus-schedule-rule-limits--detail' }, [
		line(_('IPv4'), d4, u4),
		line(_('IPv6'), d6, u6)
	]);
}

var BPLUS_TREND_MAX_POINTS = 1200;
var BPLUS_TREND_MAX_RATE_BPS = 1024 * 1024 * 1024 * 10; // 10 GB/s guardrail
/* Chart CSS size: parent width + fixed height (same idea as luci-app-bandix drawIncrementsChart / #history-canvas). */
var BPLUS_TREND_CHART_CSS_H = 220;
var BPLUS_STATS_CHART_CSS_H = 280;
var BPLUS_STATS_CHUNK_MS_HOURLY = 14 * 24 * 60 * 60 * 1000; // 14 days
var BPLUS_STATS_CHUNK_MS_DAILY = 60 * 24 * 60 * 60 * 1000; // 60 days
/* luci-app-bandix drawIncrementsChart: TX=upload orange, RX=download cyan */
var BPLUS_HIST_COLOR_UP = '#f97316';
var BPLUS_HIST_COLOR_DOWN = '#06b6d4';

function buildStatsHistogramChunks(startMs, endMs, bucket) {
	if (!startMs || !endMs || endMs <= startMs)
		return null;
	var chunkMs = bucket === 'daily' ? BPLUS_STATS_CHUNK_MS_DAILY : BPLUS_STATS_CHUNK_MS_HOURLY;
	var totalRange = endMs - startMs;
	if (totalRange <= chunkMs)
		return null;
	var chunks = [];
	for (var cursor = startMs; cursor < endMs; cursor += chunkMs)
		chunks.push({ start: cursor, end: Math.min(cursor + chunkMs, endMs) });
	return chunks.length > 1 ? chunks : null;
}

function fetchStatsHistogramChunked(iface, mac, trafficType, startMs, endMs, bucket, onProgress) {
	var chunks = buildStatsHistogramChunks(startMs, endMs, bucket);
	if (!chunks) {
		return callGetHistogram(iface, mac, trafficType, String(startMs), String(endMs), bucket)
			.then(function (r) { return unwrapData(r, []); });
	}
	if (typeof onProgress === 'function')
		onProgress(0, chunks.length);
	var chain = Promise.resolve([]);
	var done = 0;
	chunks.forEach(function (chunk) {
		chain = chain.then(function (acc) {
			return callGetHistogram(iface, mac, trafficType, String(chunk.start), String(chunk.end), bucket)
				.then(function (r) { return unwrapData(r, []); })
				.then(function (part) {
					done += 1;
					if (typeof onProgress === 'function')
						onProgress(done, chunks.length);
					if (Array.isArray(part) && part.length)
						return acc.concat(part);
					return acc;
				});
		});
	});
	return chain.then(function (all) {
		if (!Array.isArray(all) || !all.length)
			return [];
		all.sort(function (a, b) {
			return asNum((a || {}).start_ts_ms) - asNum((b || {}).start_ts_ms);
		});
		var out = [];
		var lastKey = null;
		for (var i = 0; i < all.length; i++) {
			var row = all[i] || {};
			var key = String(asNum(row.start_ts_ms));
			if (key !== lastKey) {
				out.push(row);
				lastKey = key;
			}
		}
		return out;
	});
}

function colorToRgba(color, alpha) {
	var c = String(color || '').trim();
	var a = asNum(alpha);
	if (a < 0) a = 0;
	if (a > 1) a = 1;

	var m3 = c.match(/^#([0-9a-fA-F]{3})$/);
	if (m3) {
		var h3 = m3[1];
		var r3 = parseInt(h3.charAt(0) + h3.charAt(0), 16);
		var g3 = parseInt(h3.charAt(1) + h3.charAt(1), 16);
		var b3 = parseInt(h3.charAt(2) + h3.charAt(2), 16);
		return 'rgba(' + r3 + ',' + g3 + ',' + b3 + ',' + a + ')';
	}

	var m6 = c.match(/^#([0-9a-fA-F]{6})$/);
	if (m6) {
		var h6 = m6[1];
		var r6 = parseInt(h6.slice(0, 2), 16);
		var g6 = parseInt(h6.slice(2, 4), 16);
		var b6 = parseInt(h6.slice(4, 6), 16);
		return 'rgba(' + r6 + ',' + g6 + ',' + b6 + ',' + a + ')';
	}

	var mrgb = c.match(/^rgba?\(([^)]+)\)$/i);
	if (mrgb) {
		var parts = mrgb[1].split(',');
		if (parts.length >= 3) {
			var rr = Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0));
			var gg = Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0));
			var bb = Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0));
			return 'rgba(' + rr + ',' + gg + ',' + bb + ',' + a + ')';
		}
	}

	return c;
}

function getTrafficThemeColors(rootEl) {
	var node = rootEl || document.documentElement;
	var cs = window.getComputedStyle(node);
	var up = (cs.getPropertyValue('--bplus-up') || '').trim() || BPLUS_HIST_COLOR_UP;
	var down = (cs.getPropertyValue('--bplus-down') || '').trim() || BPLUS_HIST_COLOR_DOWN;
	return { up: up, down: down };
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
		'.bplus-page{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;width:100%;max-width:100%;min-width:0;box-sizing:border-box;}',
		'.bplus-page .bplus-header{display:flex;align-items:center;justify-content:space-between;margin:0 0 4px 0;}',
		'.bplus-page .bplus-title-wrapper{display:flex;align-items:baseline;flex-wrap:wrap;gap:12px 20px;}',
		'.bplus-page .bplus-title{font-size:1.5rem;font-weight:600;margin:0;line-height:1.2;}',
		'.bplus-page .bplus-version{font-size:0.875rem;opacity:0.55;font-weight:400;}',
		'.bplus-page .bplus-section-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:0 0 12px 0;min-width:0;}',
		'.bplus-page .bplus-section-head .bplus-panel-title{margin:0;font-size:1.1rem;font-weight:600;flex:1 1 auto;min-width:0;}',
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
			'href': L.resource('bandix_plus/status.css', '?v=50')
		}));
	}
	ensureLayoutCss();
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('bandix_plus'),
			callGetVersion().then(bplusJson).catch(function () { return {}; })
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,
	addFooter: function () { return null; },

	initState: function (load) {
		this.version = load && load[1] ? load[1] : {};
		this.period = localStorage.getItem('bplus_period') || 'all';
		this.rateUnitMode = localStorage.getItem('bplus_rate_unit') === 'bit' ? 'bit' : 'byte';
		setRateUnitMode(this.rateUnitMode);
		this.selectedIface = '';
		this.selectedTrendMac = '';
		this.selectedTrendType = 'all';
		this.devicesFilterIface = '';
		this.overviewError = null;
		this.liveRefreshError = null;
		var bdm = localStorage.getItem('bplus_device_display_mode');
		this.deviceDisplayMode = bdm === 'detailed' ? 'detailed' : 'simple';
		this.deviceSortKey = 'ipv4';
		this.deviceSortAsc = true;
		this.scheduleEditingId = null;
		this.scheduleHubDevice = null;
		this.pendingDeleteScheduleId = null;
		this.overview = [];
		this.devices = [];
		this.trend = [];
		this.trendRaw = [];
		this.histogram = [];
		this.usageRanking = [];
		this.usageRankingShowAll = false;
		this.chartScale = 1;
		this.chartOffset = 0;
		this.chartHoverIndex = null;
		/* luci-app-bandix historyHover: pause trend poll while pointer on chart (desktop). */
		this.trendChartPauseRefresh = false;
		this.statsHoverIndex = null;
		this.rate = {
			schedules: [],
			ifaceLimits: [],
			guestDefaults: [],
			guestWhitelist: []
		};
		this.ifaceLimitEditingIface = '';
		this.guestRuleEditingIface = '';
		this.guestRuleModalMode = 'add';
		this.guestRuleWhitelist = [];
		this.scheduleDayButtonList = [];
		this.liveReqSeq = 0;
		this.trendReqSeq = 0;
		this.statsReqSeq = 0;
	},

	setThemeClass: function () {
		var m = getThemeMode();
		this.root.classList.remove('theme-light', 'theme-dark');
		this.root.classList.add('theme-' + m);
	},

	setRateUnitMode: function (mode, persist) {
		var prev = this.rateUnitMode === 'bit' ? 'bit' : 'byte';
		var next = mode === 'bit' ? 'bit' : 'byte';
		if (prev !== next)
			this.updateModalRateInputsForModeChange(prev, next);
		this.rateUnitMode = next;
		setRateUnitMode(next);
		if (persist !== false) localStorage.setItem('bplus_rate_unit', next);
		if (this.el.rateUnitBtnByte)
			this.el.rateUnitBtnByte.className = 'bplus-unit-btn' + (next === 'byte' ? ' is-active' : '');
		if (this.el.rateUnitBtnBit)
			this.el.rateUnitBtnBit.className = 'bplus-unit-btn' + (next === 'bit' ? ' is-active' : '');
		this.syncRateLimitUnitControls(next);
	},

	populateRateLimitUnitSelect: function (sel, mode, preferredKey) {
		if (!sel) return;
		var list = getRateLimitUnitChoices(mode);
		var keep = String(preferredKey || sel.value || 'm').toLowerCase();
		dom.content(sel, []);
		for (var i = 0; i < list.length; i++)
			sel.appendChild(E('option', { 'value': list[i].key }, [ list[i].label ]));
		sel.value = keep;
		if (sel.value !== keep)
			sel.value = 'm';
		if (!sel.value && list.length)
			sel.value = list[0].key;
		sel.setAttribute('data-prev-unit', sel.value || 'm');
	},

	rateLimitInputToKbps: function (value, unitKey, mode) {
		var n = asNum(value);
		if (!isFinite(n) || n <= 0) return 0;
		var ch = pickRateLimitUnitChoice(mode, unitKey);
		return Math.max(0, Math.round(n * asNum(ch.kbps_factor)));
	},

	kbpsToRateLimitInput: function (kbps, mode, preferredUnitKey) {
		var total = asNum(kbps);
		if (!isFinite(total) || total <= 0)
			return { value: '0', unitKey: String(preferredUnitKey || 'm').toLowerCase() };
		var selected = pickRateLimitUnitChoice(mode, preferredUnitKey);
		if (!preferredUnitKey) {
			var choices = getRateLimitUnitChoices(mode);
			for (var i = choices.length - 1; i >= 0; i--) {
				var f = asNum(choices[i].kbps_factor);
				if (f > 0 && total / f >= 1) {
					selected = choices[i];
					break;
				}
			}
		}
		var factor = Math.max(0.000001, asNum(selected.kbps_factor));
		return {
			value: formatRateLimitInputNumber(total / factor),
			unitKey: selected.key
		};
	},

	setRateLimitFieldFromKbps: function (kbps, inputEl, unitSel, preferredUnitKey) {
		if (!inputEl || !unitSel) return;
		var mode = this.rateUnitMode === 'bit' ? 'bit' : 'byte';
		var selectedKey = String(preferredUnitKey || unitSel.value || 'm').toLowerCase();
		if (!preferredUnitKey)
			selectedKey = this.kbpsToRateLimitInput(kbps, mode).unitKey;
		this.populateRateLimitUnitSelect(unitSel, mode, selectedKey);
		var valueInfo = this.kbpsToRateLimitInput(kbps, mode, unitSel.value || selectedKey);
		inputEl.value = valueInfo.value;
	},

	getRateLimitFieldAsKbps: function (inputEl, unitSel) {
		var mode = this.rateUnitMode === 'bit' ? 'bit' : 'byte';
		var key = unitSel ? unitSel.value : 'm';
		return this.rateLimitInputToKbps(inputEl ? inputEl.value : 0, key, mode);
	},

	getRateLimitModalFields: function () {
		var fields = [];
		if (!this.el) return fields;
		var addField = function (inputEl, unitSel) {
			if (inputEl && unitSel) fields.push({ input: inputEl, unit: unitSel });
		};
		addField(this.el.schD4, this.el.schD4Unit);
		addField(this.el.schD6, this.el.schD6Unit);
		addField(this.el.schU4, this.el.schU4Unit);
		addField(this.el.schU6, this.el.schU6Unit);
		addField(this.el.ifaceLimitD4Modal, this.el.ifaceLimitD4UnitModal);
		addField(this.el.ifaceLimitD6Modal, this.el.ifaceLimitD6UnitModal);
		addField(this.el.ifaceLimitU4Modal, this.el.ifaceLimitU4UnitModal);
		addField(this.el.ifaceLimitU6Modal, this.el.ifaceLimitU6UnitModal);
		addField(this.el.guestRuleD4, this.el.guestRuleD4Unit);
		addField(this.el.guestRuleD6, this.el.guestRuleD6Unit);
		addField(this.el.guestRuleU4, this.el.guestRuleU4Unit);
		addField(this.el.guestRuleU6, this.el.guestRuleU6Unit);
		return fields;
	},

	updateModalRateInputsForModeChange: function (prevMode, nextMode) {
		var fields = this.getRateLimitModalFields();
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i];
			var keepKey = String((field.unit && field.unit.value) || 'm').toLowerCase();
			this.populateRateLimitUnitSelect(field.unit, nextMode, keepKey);
		}
	},

	syncRateLimitUnitControls: function (mode) {
		var next = mode === 'bit' ? 'bit' : 'byte';
		var fields = this.getRateLimitModalFields();
		for (var i = 0; i < fields.length; i++) {
			var field = fields[i];
			this.populateRateLimitUnitSelect(field.unit, next, field.unit && field.unit.value);
		}
	},

	onRateLimitUnitSelectChanged: function (sel, inputEl) {
		if (!sel || !inputEl) return;
		var newKey = String(sel.value || 'm').toLowerCase();
		sel.setAttribute('data-prev-unit', newKey);
	},

	refreshRateUnitDisplays: function () {
		this.renderOverviewGrid();
		this.renderIfaceLimitTable();
		this.renderGuestControlTable();
		if (this.el.scheduleHubOverlay && this.el.scheduleHubOverlay.classList.contains('show'))
			this.renderScheduleHubRulesList();
		if (!this.isScheduleHubUiOpen())
			this.renderDevicesTable();
		this.drawTrendChart();
		this.drawStatsChart();
		this.updateStatsHistogramSummary();
	},

	applyPeriod: function (v) {
		return v === 'all' ? '' : v;
	},

	updateStatsHistogramTimeline: function () {
		var timeline = this.el.statsTimeline;
		var timelineRange = this.el.statsTimelineRange;
		var startStr = this.el.statsStart.value;
		var endStr = this.el.statsEnd.value;
		if (!timeline || !timelineRange || !startStr || !endStr) return;
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		var todayMs = today.getTime();
		var startMs = new Date(startStr + 'T00:00:00').getTime();
		var endMs = new Date(endStr + 'T23:59:59').getTime();
		var oneYearAgoMs = todayMs - 365 * 24 * 60 * 60 * 1000;
		var totalRange = todayMs - oneYearAgoMs;
		var selectedRange = endMs - startMs;
		var leftPercent = Math.max(0, ((startMs - oneYearAgoMs) / totalRange) * 100);
		var widthPercent = Math.min(100, (selectedRange / totalRange) * 100);
		timelineRange.style.left = leftPercent + '%';
		timelineRange.style.width = widthPercent + '%';
	},

	updateRankTimeline: function () {
		var timeline = this.el.rankTimeline;
		var timelineRange = this.el.rankTimelineRange;
		var startStr = this.el.rankStart.value;
		var endStr = this.el.rankEnd.value;
		if (!timeline || !timelineRange || !startStr || !endStr) return;
		var today = new Date();
		today.setHours(0, 0, 0, 0);
		var todayMs = today.getTime();
		var startMs = new Date(startStr + 'T00:00:00').getTime();
		var endMs = new Date(endStr + 'T23:59:59').getTime();
		var oneYearAgoMs = todayMs - 365 * 24 * 60 * 60 * 1000;
		var totalRange = todayMs - oneYearAgoMs;
		var selectedRange = endMs - startMs;
		var leftPercent = Math.max(0, ((startMs - oneYearAgoMs) / totalRange) * 100);
		var widthPercent = Math.min(100, (selectedRange / totalRange) * 100);
		timelineRange.style.left = leftPercent + '%';
		timelineRange.style.width = widthPercent + '%';
	},

	renderUsageRanking: function () {
		var list = Array.isArray(this.usageRanking) ? this.usageRanking : [];
		var wrap = this.el.rankWrap;
		if (!wrap) return;
		dom.content(wrap, []);

		if (this.el.rankTimerange) {
			var start = dateStartMs(this.el.rankStart.value);
			var end = dateEndMs(this.el.rankEnd.value);
			if (start != null && end != null) {
				var up = 0;
				var down = 0;
				var total = 0;
				for (var si = 0; si < list.length; si++) {
					var row = list[si] || {};
					up += asNum(row.up_bytes);
					down += asNum(row.down_bytes);
					total += asNum(row.total_bytes);
				}
				this.el.rankTimerange.textContent =
					formatSlashDateTimeRange(start, end) +
					' · ↑' + formatBytes(up) +
					' · ↓' + formatBytes(down) +
					' · ' + formatBytes(total);
			}
			else {
				this.el.rankTimerange.textContent = '';
			}
		}

		if (!list.length) {
			wrap.appendChild(E('div', { 'class': 'loading-state' }, [ _('No data') ]));
			return;
		}

		var maxTotal = 0;
		for (var mi = 0; mi < list.length; mi++)
			maxTotal = Math.max(maxTotal, asNum((list[mi] || {}).total_bytes));
		if (maxTotal <= 0) maxTotal = 1;

		var DEFAULT_LIMIT = 10;
		var showAll = !!this.usageRankingShowAll;
		var displayList = showAll ? list : list.slice(0, DEFAULT_LIMIT);

		var rankingList = E('div', { 'class': 'usage-ranking-list' });
		for (var i = 0; i < displayList.length; i++) {
			var x = displayList[i] || {};
			var hn = String(x.hostname || '').trim();
			var mac = String(x.mac || '—');
			var ip4 = Array.isArray(x.ipv4) && x.ipv4.length ? String(x.ipv4[0]) : '';
			var up = asNum(x.up_bytes);
			var down = asNum(x.down_bytes);
			var total = asNum(x.total_bytes);
			var pct = (total / maxTotal) * 100;

			rankingList.appendChild(E('div', {
				'class': 'usage-ranking-item',
				'style': '--progress-width: ' + pct.toFixed(2) + '%;'
			}, [
				E('div', { 'class': 'usage-ranking-rank' }, [ String(i + 1) ]),
				E('div', { 'class': 'usage-ranking-info' }, [
					E('div', { 'class': 'usage-ranking-device' }, [
						E('div', { 'class': 'usage-ranking-name' }, [ hn || ip4 || mac ]),
						E('div', { 'class': 'usage-ranking-meta' }, [
							E('span', {}, [ ip4 || '—' ]),
							E('span', {}, [ mac ]),
							E('span', { 'class': 'usage-ranking-meta-total' }, [ formatBytes(total) ])
						])
					]),
					E('div', { 'class': 'usage-ranking-stats' }, [
						E('div', { 'class': 'usage-ranking-traffic' }, [
							E('span', { 'class': 'usage-ranking-traffic-item tx' }, [
								E('span', { 'class': 'usage-ranking-traffic-arrow' }, [ '↑' ]),
								E('span', {}, [ formatBytes(up) ])
							]),
							E('span', { 'class': 'usage-ranking-traffic-item rx' }, [
								E('span', { 'class': 'usage-ranking-traffic-arrow' }, [ '↓' ]),
								E('span', {}, [ formatBytes(down) ])
							]),
							E('span', { 'class': 'usage-ranking-traffic-item total' }, [ formatBytes(total) ])
						])
					])
				])
			]));
		}
		wrap.appendChild(rankingList);

		if (list.length > DEFAULT_LIMIT) {
			var toggleBtn = E('button', { 'type': 'button', 'class': 'usage-ranking-toggle-btn' }, [
				showAll ? _('Show Top %d').format(DEFAULT_LIMIT) : _('Show All')
			]);
			toggleBtn.addEventListener('click', L.bind(function (ev) {
				ev.preventDefault();
				ev.stopPropagation();
				this.usageRankingShowAll = !this.usageRankingShowAll;
				this.renderUsageRanking();
			}, this));

			wrap.appendChild(E('div', { 'class': 'usage-ranking-controls' }, [
				E('span', { 'class': 'usage-ranking-info-text' }, [
					showAll ? _('Showing all %d devices').format(list.length) : _('Showing top %d of %d devices').format(displayList.length, list.length)
				]),
				toggleBtn
			]));
		}
	},

	updateStatsHistogramSummary: function () {
		var el = this.el.statsHistogramTimerange;
		if (!el) return;
		var start = dateStartMs(this.el.statsStart.value);
		var end = dateEndMs(this.el.statsEnd.value);
		if (start == null || end == null) {
			el.textContent = '';
			if (this.el.statsSummaryUpVal) this.el.statsSummaryUpVal.textContent = '—';
			if (this.el.statsSummaryDownVal) this.el.statsSummaryDownVal.textContent = '—';
			if (this.el.statsSummaryTotalVal) this.el.statsSummaryTotalVal.textContent = '—';
			return;
		}
		var data = this.histogram || [];
		var up = 0;
		var down = 0;
		for (var i = 0; i < data.length; i++) {
			up += sumUpBytes(data[i]);
			down += sumDownBytes(data[i]);
		}
		var total = up + down;
		var rangeStr = formatSlashDateTimeRange(start, end);
		el.textContent = rangeStr + ' · ↑' + formatBytes(up) + ' · ↓' + formatBytes(down) + ' · ' + formatBytes(total) + ' · ' + String(data.length) + ' ' + _('entries');
		if (this.el.statsSummaryUpVal) this.el.statsSummaryUpVal.textContent = formatBytes(up);
		if (this.el.statsSummaryDownVal) this.el.statsSummaryDownVal.textContent = formatBytes(down);
		if (this.el.statsSummaryTotalVal) this.el.statsSummaryTotalVal.textContent = formatBytes(total);
	},

	queryStatsIfIfaceSelected: function () {
		if (!this.el.statsIface || !this.el.statsIface.value) return;
		this.queryStats();
	},

	queryUsageRankingIfIfaceSelected: function () {
		if (!this.el.rankIface || !this.el.rankIface.value) return;
		this.queryUsageRanking();
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

	setStatsLoadingNotice: function (text) {
		var n = this.el && this.el.statsLoadingNotice;
		if (!n) return;
		var t = String(text || '').trim();
		if (!t) {
			n.textContent = '';
			n.style.display = 'none';
			return;
		}
		n.textContent = t;
		n.style.display = '';
	},

		/** True while schedule hub or nested rule modal is visible — avoids tearing down tbody during poll refresh (lost click / ghost clicks). */
		isScheduleHubUiOpen: function () {
			return !!(this.el.scheduleHubOverlay && this.el.scheduleHubOverlay.classList.contains('show'))
				|| !!(this.el.scheduleRuleOverlay && this.el.scheduleRuleOverlay.classList.contains('show'))
				|| !!(this.el.scheduleDeleteConfirmOverlay && this.el.scheduleDeleteConfirmOverlay.classList.contains('show'));
		},

		/** True while hovering device rule popover trigger/content; avoids repaint closing the hover popover. */
		isDeviceRulePopoverHovered: function () {
			if (!this.el || !this.el.deviceBody || !this.el.deviceBody.querySelector)
				return false;
			return !!this.el.deviceBody.querySelector('.bplus-device-rule-stack:hover');
		},

	findDeviceForScheduleClick: function (macAttr, ifaceAttr) {
		var mk = this.normalizeMacKey(macAttr);
		var iface = String(ifaceAttr || '');
		var list = this.devices;
		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			if (this.normalizeMacKey(d.mac) === mk && String(deviceIfaceName(d) || '') === iface)
				return d;
		}
		return null;
	},

	todayScheduleDayNumber: function () {
		var wd = new Date().getDay(); // 0=Sun..6=Sat
		return wd === 0 ? 7 : wd; // 1=Mon..7=Sun
	},

	parseScheduleHmToMin: function (hm) {
		var s = String(hm || '').trim();
		var m = s.match(/^(\d{1,2}):(\d{2})$/);
		if (!m) return -1;
		var h = parseInt(m[1], 10);
		var mm = parseInt(m[2], 10);
		if (isNaN(h) || isNaN(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return -1;
		return h * 60 + mm;
	},

	isScheduleRuleActiveNow: function (rule) {
		var t = rule && rule.time_slot ? rule.time_slot : {};
		var days = Array.isArray(t.days) ? t.days : [];
		if (!days.length) return false;
		var startMin = this.parseScheduleHmToMin(t.start);
		var endMin = this.parseScheduleHmToMin(t.end);
		if (startMin < 0 || endMin < 0) return false;

		var daySet = {};
		for (var i = 0; i < days.length; i++) {
			var dn = asNum(days[i]);
			if (dn >= 1 && dn <= 7) daySet[String(dn)] = 1;
		}
		var now = new Date();
		var nowMin = now.getHours() * 60 + now.getMinutes();
		var today = this.todayScheduleDayNumber();
		var yday = today === 1 ? 7 : (today - 1);

		// Same start/end means always active on scheduled day.
		if (startMin === endMin)
			return !!daySet[String(today)];

		if (startMin < endMin)
			return !!daySet[String(today)] && nowMin >= startMin && nowMin < endMin;

		// Overnight slot, e.g. 23:00-06:00
		return (!!daySet[String(today)] && nowMin >= startMin) ||
			(!!daySet[String(yday)] && nowMin < endMin);
	},

	deviceScheduleRulesForDevice: function (dev) {
		var iface = String(deviceIfaceName(dev) || '').trim();
		var mkey = this.normalizeMacKey(dev && dev.mac);
		var rules = this.rate && Array.isArray(this.rate.schedules) ? this.rate.schedules : [];
		var out = [];
		for (var i = 0; i < rules.length; i++) {
			var r = rules[i] || {};
			if (String(r.iface || '').trim() !== iface) continue;
			if (this.normalizeMacKey(r.mac) !== mkey) continue;
			out.push(r);
		}
		return out;
	},

	deviceScheduleRuleTimeText: function (rule) {
		var t = rule && rule.time_slot ? rule.time_slot : {};
		return (t.start || '--:--') + ' - ' + (t.end || '--:--') + ' · ' + formatScheduleDayLabels(t.days);
	},

	deviceScheduleRuleSpeedText: function (rule) {
		var up4 = formatLimitKbpsRate(rule && rule.up_v4_kbps || 0);
		var down4 = formatLimitKbpsRate(rule && rule.down_v4_kbps || 0);
		var up6 = formatLimitKbpsRate(rule && rule.up_v6_kbps || 0);
		var down6 = formatLimitKbpsRate(rule && rule.down_v6_kbps || 0);
		return 'IPv4 ' + _('Upload') + ' ' + up4 + ' · ' + _('Download') + ' ' + down4 +
			' | IPv6 ' + _('Upload') + ' ' + up6 + ' · ' + _('Download') + ' ' + down6;
	},

	deviceScheduleRuleStatus: function (dev) {
		var rules = this.deviceScheduleRulesForDevice(dev);
		var count = rules.length;
		var active = false;
		for (var i = 0; i < count; i++) {
			if (this.isScheduleRuleActiveNow(rules[i])) {
				active = true;
				break;
			}
		}
		return { count: count, active: active, rules: rules };
	},

	deviceRowKey: function (dev) {
		return String(deviceIfaceName(dev) || '') + '|' + this.normalizeMacKey(dev && dev.mac);
	},

	updateDevicesTableMetricsOnly: function () {
		var body = this.el && this.el.deviceBody;
		if (!body || !body.querySelectorAll) return false;
		var det = this.deviceDisplayMode === 'detailed';
		var rows = body.querySelectorAll('tr[data-device-row-key]');
		if (!rows || !rows.length) return false;

		var devByKey = {};
		for (var i = 0; i < this.devices.length; i++) {
			var d = this.devices[i];
			devByKey[this.deviceRowKey(d)] = d;
		}

		for (var r = 0; r < rows.length; r++) {
			var tr = rows[r];
			var key = String(tr.getAttribute('data-device-row-key') || '');
			var dev = devByKey[key];
			if (!dev) continue;
			var tds = tr.querySelectorAll('td');
			if (!tds || tds.length < 11) continue;
			var met = dev.metrics || {};
			var cum = dev.cumulative || {};
			var upRateTd = deviceTableRateTd(met, true, det);
			var downRateTd = deviceTableRateTd(met, false, det);
			var upBytesTd = deviceTableBytesTd(cum, true, det);
			var downBytesTd = deviceTableBytesTd(cum, false, det);
			tr.replaceChild(upRateTd, tds[5]);
			tds = tr.querySelectorAll('td');
			tr.replaceChild(downRateTd, tds[6]);
			tds = tr.querySelectorAll('td');
			tr.replaceChild(upBytesTd, tds[7]);
			tds = tr.querySelectorAll('td');
			tr.replaceChild(downBytesTd, tds[8]);
			tr.className = dev.online ? 'is-online' : 'is-offline';
		}
		return true;
	},

		refreshLive: function (showErr) {
			var self = this;
			var reqSeq = ++this.liveReqSeq;
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
				if (reqSeq !== this.liveReqSeq) return;
				this.overview = res[0] || [];
				var rawDevices = Array.isArray(res[1]) ? res[1] : [];
				this.devices = rawDevices.map(function (d) {
				if (!d || typeof d !== 'object') return d;
				if (!d.logical_iface) {
					var iface = deviceIfaceName(d);
					if (iface) d.logical_iface = iface;
				}
				return d;
			});

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
			if (!this.isScheduleHubUiOpen()) {
				if (this.isDeviceRulePopoverHovered()) {
					this.updateDevicesTableMetricsOnly();
				} else {
					this.renderDevicesTable();
				}
				this.syncRateFormIfaceOptions();
			}
			if (this.el.overviewCount) {
				this.el.overviewCount.textContent = String(this.overview.length) + ' ' + _('entries');
			}
			return this.refreshTrend(false);
			}, this)).catch(L.bind(function (e) {
				if (reqSeq !== this.liveReqSeq) return;
				this.liveRefreshError = e.message || String(e);
				if (showErr) this.notifyError(_('Failed to refresh status'), e);
			}, this));
		},

	trendPointByteRates: function (x) {
		var tt = String(this.selectedTrendType || '').trim();
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
		var up = upBps / 8;
		var down = downBps / 8;
		if (up < 0) up = 0;
		if (down < 0) down = 0;
		if (up * 8 > BPLUS_TREND_MAX_RATE_BPS) up = BPLUS_TREND_MAX_RATE_BPS / 8;
		if (down * 8 > BPLUS_TREND_MAX_RATE_BPS) down = BPLUS_TREND_MAX_RATE_BPS / 8;
		return { ts_ms: asNum(x.ts_ms), up: up, down: down, raw: x };
	},

		refreshTrend: function (showErr) {
			var reqSeq = ++this.trendReqSeq;
			if (!this.selectedIface) {
				this.trend = [];
				this.trendRaw = [];
			this.drawTrendChart();
			if (this.el.trendCount) this.el.trendCount.textContent = formatEntriesPillText(0);
			return Promise.resolve();
		}
		if (this.trendChartPauseRefresh)
			return Promise.resolve();
		var mac = this.selectedTrendMac || '';
		var tt = this.selectedTrendType === 'all' ? '' : (this.selectedTrendType || '');
			return callGetTrend(this.selectedIface, mac, tt, '')
				.then(function (r) { return unwrapData(r, []); })
				.then(L.bind(function (list) {
					if (reqSeq !== this.trendReqSeq) return;
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
					this.el.trendCount.textContent = formatEntriesPillText(this.trend.length);
				}
				this.drawTrendChart();
				}, this)).catch(L.bind(function (e) {
				if (reqSeq !== this.trendReqSeq) return;
				this.trend = [];
				this.trendRaw = [];
				this.drawTrendChart();
			if (this.el.trendCount) this.el.trendCount.textContent = formatEntriesPillText(0);
			if (showErr) this.notifyError(_('Failed to refresh trend'), e);
		}, this));
	},

	refreshRateData: function (showErr) {
		return Promise.all([
			callGetSchedules().then(function (r) { return unwrapData(r, []); }),
			callGetIfaceLimits().then(function (r) { return unwrapData(r, []); }),
			callGetGuestDefaults().then(function (r) { return unwrapData(r, []); }),
			callGetGuestWhitelist().then(function (r) { return unwrapData(r, []); })
		]).then(L.bind(function (res) {
			this.rate.schedules = res[0] || [];
			this.rate.ifaceLimits = res[1] || [];
			this.rate.guestDefaults = res[2] || [];
			this.rate.guestWhitelist = res[3] || [];
			if (!this.isScheduleHubUiOpen()) {
				this.renderIfaceLimitTable();
				this.renderGuestControlTable();
			}
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
			grid.appendChild(E('div', { 'class': 'overview-state overview-state--empty' }, [ _('No data') ]));
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
			var ifname = String(item.ifname != null ? item.ifname : '') || '';
			var ifaceLimit = ifname ? this.findIfaceLimitByIface(ifname) : null;
			var headBits = [ E('div', { 'class': 'overview-card__title' }, [ ifname || '—' ]) ];
			var actions = E('div', { 'class': 'overview-card__actions' });
			if (zoneStr) {
				actions.appendChild(E('div', { 'class': 'overview-card__badges' }, [
					E('span', { 'class': 'overview-pill overview-pill--zone' }, [ zoneStr ])
				]));
			}
			actions.appendChild(E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-action bplus-overview-limit-btn',
				'data-iface': ifname,
				'title': _('Set iface limit'),
				'aria-label': _('Set iface limit'),
				'disabled': ifname ? null : 'disabled'
			}, [ '⚙' ]));
			headBits.push(actions);
			var cardBits = [
				E('div', { 'class': 'overview-card__head' }, headBits),
				E('section', { 'class': 'overview-card__block overview-card__block--rate' }, [
					E('div', { 'class': 'overview-hero-pair' }, [
						this.overviewHeroSpeed(_('Upload'), upBps, metrics.up_v4_bps, metrics.up_v6_bps, false, 'up', cumUp, cumulative.up_v4_bytes, cumulative.up_v6_bytes),
						this.overviewHeroSpeed(_('Download'), downBps, metrics.down_v4_bps, metrics.down_v6_bps, false, 'down', cumDown, cumulative.down_v4_bytes, cumulative.down_v6_bytes)
					])
				])
			];
			cardBits.push(E('section', { 'class': 'overview-card__block overview-card__block--limit' }, [
				E('div', { 'class': 'overview-limit-line' }, [
					E('span', { 'class': 'overview-limit-k' }, [ _('Upload') ]),
					E('span', { 'class': 'overview-limit-v' }, [
						'IPv4 ' + formatLimitKbpsRate(ifaceLimit ? ifaceLimit.up_v4_kbps : 0) +
						' · IPv6 ' + formatLimitKbpsRate(ifaceLimit ? ifaceLimit.up_v6_kbps : 0)
					])
				]),
				E('div', { 'class': 'overview-limit-line' }, [
					E('span', { 'class': 'overview-limit-k' }, [ _('Download') ]),
					E('span', { 'class': 'overview-limit-v' }, [
						'IPv4 ' + formatLimitKbpsRate(ifaceLimit ? ifaceLimit.down_v4_kbps : 0) +
						' · IPv6 ' + formatLimitKbpsRate(ifaceLimit ? ifaceLimit.down_v6_kbps : 0)
					])
				])
			]));
			var card = E('article', { 'class': 'overview-card' }, cardBits);
			grid.appendChild(card);
		}
	},

	renderDevicesIfaceFilterOptions: function () {
		var sel = this.el.devicesIfaceSelect;
		if (!sel) return;
		var old = this.devicesFilterIface;
		var seen = {};
		var rows = [ { value: '', label: _('All interfaces') } ];
		for (var i = 0; i < this.overview.length; i++) {
			var n = this.overview[i].ifname;
			if (n && !seen[n]) {
				seen[n] = 1;
				rows.push({ value: n, label: n });
			}
		}
		for (var j = 0; j < this.devices.length; j++) {
			var li = deviceIfaceName(this.devices[j]);
			if (li && !seen[li]) {
				seen[li] = 1;
				rows.push({ value: li, label: li });
			}
		}
		if (!hasSameSelectOptions(sel, rows)) {
			var nodes = [];
			for (var k = 0; k < rows.length; k++) {
				nodes.push(E('option', { 'value': rows[k].value }, [ rows[k].label ]));
			}
			dom.content(sel, nodes);
		}
		if (old) sel.value = old;
		this.devicesFilterIface = sel.value || '';
	},

	renderIfaceOptions: function () {
		var sel = this.el.ifaceSelect;
		if (!sel) return;
		var old = this.selectedIface;
		var rows = [];
		for (var i = 0; i < this.overview.length; i++) {
			var o = this.overview[i];
			rows.push({
				value: o.ifname,
				label: o.ifname + ' (' + (o.zone || '—') + ')'
			});
		}
		if (!hasSameSelectOptions(sel, rows)) {
			var nodes = [];
			for (var j = 0; j < rows.length; j++) {
				nodes.push(E('option', { 'value': rows[j].value }, [ rows[j].label ]));
			}
			dom.content(sel, nodes);
		}
		if (old) sel.value = old;
		if (!sel.value && rows.length) sel.value = rows[0].value;
		this.selectedIface = sel.value || '';
	},

	renderTrendDeviceOptions: function () {
		var sel = this.el.trendDeviceSelect;
		if (!sel) return;
		var old = this.selectedTrendMac;
		var rows = [ { value: '', label: _('All Devices') } ];
		var iface = this.selectedIface;
		var list = this.devices.filter(function (d) {
			return !iface || deviceIfaceName(d) === iface;
		});
		list.sort(function (a, b) {
			return String(a.mac).localeCompare(String(b.mac));
		});
		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			var label = (d.hostname || '—') + ' | ' + d.mac;
			rows.push({
				value: d.mac,
				label: label
			});
		}
		if (!hasSameSelectOptions(sel, rows)) {
			var nodes = [];
			for (var j = 0; j < rows.length; j++) {
				nodes.push(E('option', { 'value': rows[j].value }, [ rows[j].label ]));
			}
			dom.content(sel, nodes);
		}
		sel.value = old;
		this.selectedTrendMac = sel.value || '';
	},

	renderStatsIfaceOptions: function () {
		var sel = this.el.statsIface;
		if (!sel) return;
		var old = sel.value || this.selectedIface;
		var rows = [];
		for (var i = 0; i < this.overview.length; i++) {
			var o = this.overview[i];
			rows.push({
				value: o.ifname,
				label: o.ifname + ' (' + (o.zone || '—') + ')'
			});
		}
		if (!hasSameSelectOptions(sel, rows)) {
			if (document.activeElement !== sel) {
				var nodes = [];
				for (var j = 0; j < rows.length; j++)
					nodes.push(E('option', { 'value': rows[j].value }, [ rows[j].label ]));
				dom.content(sel, nodes);
			}
		}
		if (old) sel.value = old;
		if (!sel.value && this.overview.length) sel.value = this.overview[0].ifname;
		this.renderUsageRankingIfaceOptions();
		this.renderStatsMacOptions();
	},

	renderUsageRankingIfaceOptions: function () {
		var sel = this.el.rankIface;
		if (!sel) return;
		var old = sel.value || (this.el.statsIface ? this.el.statsIface.value : '') || this.selectedIface;
		var rows = [];
		for (var i = 0; i < this.overview.length; i++) {
			var o = this.overview[i];
			rows.push({
				value: o.ifname,
				label: o.ifname + ' (' + (o.zone || '—') + ')'
			});
		}
		if (!hasSameSelectOptions(sel, rows)) {
			if (document.activeElement !== sel) {
				var nodes = [];
				for (var j = 0; j < rows.length; j++)
					nodes.push(E('option', { 'value': rows[j].value }, [ rows[j].label ]));
				dom.content(sel, nodes);
			}
		}
		if (old) sel.value = old;
		if (!sel.value && this.overview.length) sel.value = this.overview[0].ifname;
	},

	renderStatsMacOptions: function () {
		var sel = this.el.statsMacSelect;
		if (!sel) return;
		var old = sel.value;
		var iface = this.el.statsIface ? this.el.statsIface.value : '';
		dom.content(sel, [ E('option', { 'value': '' }, [ _('All devices') ]) ]);
		var list = this.devices.filter(function (d) {
			return !iface || deviceIfaceName(d) === iface;
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
			if (key === 'host') {
				av = (a.hostname || '').toLowerCase();
				bv = (b.hostname || '').toLowerCase();
			}
			else if (key === 'iface') {
				av = deviceIfaceName(a);
				bv = deviceIfaceName(b);
			}
			else if (key === 'ipv4') {
				av = deviceFirstIpv4Uint(a);
				bv = deviceFirstIpv4Uint(b);
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
			else if (key === 'up_bytes') {
				av = sumUpBytes(a.cumulative);
				bv = sumUpBytes(b.cumulative);
			}
			else if (key === 'down_bytes') {
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
		var preserveRuleCells = this.isDeviceRulePopoverHovered();
		var preservedRuleTdByKey = {};
		if (preserveRuleCells && body && body.querySelectorAll) {
			var oldRows = body.querySelectorAll('tr[data-device-row-key]');
			for (var orx = 0; orx < oldRows.length; orx++) {
				var oldRow = oldRows[orx];
				var oldKey = String(oldRow.getAttribute('data-device-row-key') || '');
				if (!oldKey) continue;
				var oldTds = oldRow.querySelectorAll('td');
				if (oldTds && oldTds.length >= 10)
					preservedRuleTdByKey[oldKey] = oldTds[9];
			}
		}
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
			sortable(_('Iface'), 'iface'),
			E('th', {}, [ _('Hostname') ]),
			sortable(_('MAC'), 'mac'),
			sortable('IPv4', 'ipv4'),
			E('th', {}, [ 'IPv6' ]),
			sortable(_('Upload Rate'), 'rate_up'),
			sortable(_('Download Rate'), 'rate_down'),
			sortable(_('Upload bytes'), 'up_bytes'),
			sortable(_('Download bytes'), 'down_bytes'),
			E('th', {}, [ _('Limit Rule') ]),
			E('th', {}, [ _('Actions') ])
		]);
		head.appendChild(trh);

		var list = this.getSortedDevices();
		var online = 0;
		for (var oi = 0; oi < list.length; oi++) {
			if (list[oi].online) online++;
		}
		if (this.el.devicesCount) {
			this.el.devicesCount.textContent = _('Online devices') + ': ' + String(online) + ' / ' + String(list.length);
		}

		if (!list.length) {
			body.appendChild(E('tr', {}, [ E('td', { 'colspan': '11', 'class': 'bplus-empty' }, [ _('No devices') ]) ]));
			return;
		}

		var det = this.deviceDisplayMode === 'detailed';
		for (var i = 0; i < list.length; i++) {
			var d = list[i];
			var rowKey = this.deviceRowKey(d);
			var cum = d.cumulative || {};
			var met = d.metrics || {};
			var hostDisplay = d.hostname === '-' || d.hostname == null || String(d.hostname).trim() === '' ? '' : String(d.hostname);
			var hostText = hostDisplay || '—';
			var hostTd = det
				? E('td', { 'class': 'bplus-host bplus-host-cell--stacked' }, [
					E('div', { 'class': 'bplus-host-stack' }, [
						E('div', { 'class': 'bplus-host-primary' }, [ hostText ]),
						E('div', { 'class': 'bplus-host-sub' }, [ formatDeviceLastSeenMs(d.last_seen_ms) ])
					])
				])
				: E('td', { 'class': 'bplus-host' }, [ hostText ]);
			var ruleTd = (function () {
				var st = self.deviceScheduleRuleStatus(d);
				var pillCls = st.count <= 0 ? 'is-none' : (st.active ? 'is-active' : 'is-inactive');
				var pillTxt = st.count <= 0 ? _('No rule') : (st.active ? _('Active') : _('Inactive'));
				var header = E('div', { 'class': 'bplus-device-rule-head' }, [
					E('span', { 'class': 'bplus-device-rule-pill ' + pillCls }, [ pillTxt ]),
					E('span', { 'class': 'bplus-device-rule-count' }, [ String(st.count) ])
				]);
				if (st.count <= 0)
					return E('td', { 'class': 'bplus-device-rule-cell' }, [ header ]);
				var details = [];
				for (var ri = 0; ri < st.rules.length; ri++) {
					var rule = st.rules[ri];
					details.push(E('div', { 'class': 'bplus-device-rule-detail' }, [
						E('div', { 'class': 'bplus-device-rule-time' }, [ self.deviceScheduleRuleTimeText(rule) ]),
						E('div', { 'class': 'bplus-device-rule-speed' }, [ self.deviceScheduleRuleSpeedText(rule) ])
					]));
				}
				var pop = E('div', { 'class': 'bplus-device-rule-popover' }, details);
				return E('td', { 'class': 'bplus-device-rule-cell' }, [
					E('div', { 'class': 'bplus-device-rule-stack' }, [ header, pop ])
				]);
			})();
			if (preserveRuleCells && preservedRuleTdByKey[rowKey])
				ruleTd = preservedRuleTdByKey[rowKey];
			var tr = E('tr', { 'class': d.online ? 'is-online' : 'is-offline', 'data-device-row-key': rowKey }, [
				E('td', {}, [ deviceIfaceName(d) || '—' ]),
				hostTd,
				E('td', { 'class': 'bplus-mono' }, [ d.mac || '—' ]),
				E('td', {}, [ (d.ipv4 && d.ipv4.length) ? d.ipv4.join(', ') : '—' ]),
				E('td', {}, [ (d.ipv6 && d.ipv6.length) ? d.ipv6.join(', ') : '—' ]),
				deviceTableRateTd(met, true, det),
				deviceTableRateTd(met, false, det),
				deviceTableBytesTd(cum, true, det),
				deviceTableBytesTd(cum, false, det),
				ruleTd,
				E('td', { 'class': 'bplus-device-actions' }, [
					E('button', {
						'type': 'button',
						'class': 'btn cbi-button cbi-button-action bplus-device-settings-btn',
						'data-bplus-mac': d.mac || '',
						'data-bplus-iface': deviceIfaceName(d) || ''
					}, [ _('Settings') ])
				])
			]);
			body.appendChild(tr);
		}
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

		ctx.fillStyle = '#8a8a8a';
		ctx.font = '11px sans-serif';
		var maxLabelW = 0;
		for (var twI = 0; twI <= 4; twI++) {
			var tickV = maxV * (1 - twI / 4);
			var mw = ctx.measureText(formatRate(tickV)).width;
			if (mw > maxLabelW) maxLabelW = mw;
		}
		pad.l = Math.max(56, Math.ceil(maxLabelW) + 22);
		var minPlotW = 80;
		if (pad.l + pad.r + minPlotW > cw) pad.l = Math.max(40, cw - pad.r - minPlotW);
		pw = cw - pad.l - pad.r;
		canvas.__trendPadL = pad.l;

		var isMobile = cw <= 768;
		ctx.strokeStyle = 'rgba(148,163,184,0.08)';
		ctx.lineWidth = 0.8;
		for (var gy = 0; gy <= 4; gy++) {
			var y = pad.t + (ph * gy / 4);
			ctx.beginPath();
			ctx.moveTo(pad.l, y);
			ctx.lineTo(cw - pad.r, y);
			ctx.stroke();
		}

		ctx.textAlign = 'right';
		for (var ty = 0; ty <= 4; ty++) {
			var v = maxV * (1 - ty / 4);
			var y2 = pad.t + (ph * ty / 4) + 4;
			ctx.fillText(formatRate(v), pad.l - 10, y2);
		}

		function toX(i) {
			if (view.length <= 1) return pad.l;
			return pad.l + (i * pw / (view.length - 1));
		}
		function toY(v) {
			return pad.t + ph - (v / maxV) * ph;
		}

		/* luci-app-bandix drawHistoryChart: area fill + thin stroke (upload under download) */
		function drawAreaSeries(getVal, strokeColor, gradientFrom, gradientTo) {
			if (!view.length) return;
			var n = view.length;
			ctx.beginPath();
			for (var k = 0; k < n; k++) {
				var val = Math.max(0, getVal(view[k]));
				var xk = toX(k);
				var yk = toY(val);
				if (k === 0) ctx.moveTo(xk, yk);
				else ctx.lineTo(xk, yk);
			}
			ctx.lineTo(pad.l + pw, pad.t + ph);
			ctx.lineTo(pad.l, pad.t + ph);
			ctx.closePath();
			var grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
			grad.addColorStop(0, gradientFrom);
			grad.addColorStop(1, gradientTo);
			ctx.fillStyle = grad;
			ctx.fill();
			ctx.beginPath();
			for (var k2 = 0; k2 < n; k2++) {
				var val2 = Math.max(0, getVal(view[k2]));
				var x2 = toX(k2);
				var y2 = toY(val2);
				if (k2 === 0) ctx.moveTo(x2, y2);
				else ctx.lineTo(x2, y2);
			}
			ctx.strokeStyle = strokeColor;
			ctx.lineWidth = isMobile ? 1.5 : 1.2;
			ctx.stroke();
		}

		var trendColors = getTrafficThemeColors(this.root);
		drawAreaSeries(
			function (pt) { return pt.up; },
			trendColors.up,
			colorToRgba(trendColors.up, 0.16),
			colorToRgba(trendColors.up, 0.02)
		);
		drawAreaSeries(
			function (pt) { return pt.down; },
			trendColors.down,
			colorToRgba(trendColors.down, 0.12),
			colorToRgba(trendColors.down, 0.02)
		);

		/* luci-app-bandix: vertical dash at hover x; map by time so decimated view still aligns */
		if (!isMobile && typeof this.chartHoverIndex === 'number' && view.length) {
			var hIdx = this.chartHoverIndex;
			if (hIdx >= start && hIdx < end) {
				var hPt = this.trend[hIdx];
				var t0 = asNum(view[0].ts_ms);
				var t1 = asNum(view[view.length - 1].ts_ms);
				var tH = asNum(hPt.ts_ms);
				var hx;
				if (view.length <= 1 || t1 === t0)
					hx = toX(0);
				else {
					var fr = (tH - t0) / (t1 - t0);
					if (fr < 0) fr = 0;
					if (fr > 1) fr = 1;
					hx = pad.l + fr * pw;
				}
				ctx.save();
				ctx.strokeStyle = 'rgba(156,163,175,0.9)';
				ctx.lineWidth = 1;
				ctx.setLineDash([6, 4]);
				ctx.beginPath();
				ctx.moveTo(hx, pad.t);
				ctx.lineTo(hx, pad.t + ph);
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.restore();
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

	buildTrendTooltipHtml: function (p) {
		var raw = p.raw;
		var lines = [];
		function row(label, val) {
			lines.push('<div class="ht-row"><span class="ht-key">' + label + '</span><span class="ht-val">' + val + '</span></div>');
		}
		lines.push('<div class="ht-title">' + msToTimeLabel(p.ts_ms) + '</div>');

		var tt = String(this.selectedTrendType || 'all');
		var upLbl = _('Total Upload');
		var downLbl = _('Total Download');
		if (tt === 'ipv4') {
			upLbl = _('IPv4') + ' ' + _('Upload');
			downLbl = _('IPv4') + ' ' + _('Download');
		} else if (tt === 'ipv6') {
			upLbl = _('IPv6') + ' ' + _('Upload');
			downLbl = _('IPv6') + ' ' + _('Download');
		}

		lines.push(
			'<div class="ht-kpis">' +
			'<div class="ht-kpi up"><div class="ht-k-label">' + upLbl + '</div><div class="ht-k-value">' + formatRate(p.up) + '</div></div>' +
			'<div class="ht-kpi down"><div class="ht-k-label">' + downLbl + '</div><div class="ht-k-value">' + formatRate(p.down) + '</div></div>' +
			'</div>'
		);

		if (tt === 'all') {
			lines.push('<div class="ht-section-title">' + _('Other Rates') + '</div>');
			row(_('IPv4') + ' ' + _('Upload'), formatBpsAsByteRate(raw.up_v4_bps));
			row(_('IPv4') + ' ' + _('Download'), formatBpsAsByteRate(raw.down_v4_bps));
			row(_('IPv6') + ' ' + _('Upload'), formatBpsAsByteRate(raw.up_v6_bps));
			row(_('IPv6') + ' ' + _('Download'), formatBpsAsByteRate(raw.down_v6_bps));
		} else if (tt === 'ipv4') {
			lines.push('<div class="ht-section-title">' + _('Other Rates') + '</div>');
			row(_('IPv6') + ' ' + _('Upload'), formatBpsAsByteRate(raw.up_v6_bps));
			row(_('IPv6') + ' ' + _('Download'), formatBpsAsByteRate(raw.down_v6_bps));
		} else if (tt === 'ipv6') {
			lines.push('<div class="ht-section-title">' + _('Other Rates') + '</div>');
			row(_('IPv4') + ' ' + _('Upload'), formatBpsAsByteRate(raw.up_v4_bps));
			row(_('IPv4') + ' ' + _('Download'), formatBpsAsByteRate(raw.down_v4_bps));
		}

		lines.push('<div class="ht-divider"></div>');
		lines.push('<div class="ht-section-title">' + _('Cumulative') + '</div>');
		var cu4u = asNum(raw.up_v4_bytes_cumulative);
		var cu4d = asNum(raw.down_v4_bytes_cumulative);
		var cu6u = asNum(raw.up_v6_bytes_cumulative);
		var cu6d = asNum(raw.down_v6_bytes_cumulative);
		row(_('IPv4') + ' ' + _('Uploaded'), formatBytes(cu4u));
		row(_('IPv4') + ' ' + _('Downloaded'), formatBytes(cu4d));
		row(_('IPv6') + ' ' + _('Uploaded'), formatBytes(cu6u));
		row(_('IPv6') + ' ' + _('Downloaded'), formatBytes(cu6d));
		row(_('Total Uploaded'), formatBytes(cu4u + cu6u));
		row(_('Total Downloaded'), formatBytes(cu4d + cu6d));
		return lines.join('');
	},

	handleTrendEnter: function () {
		var w = window.innerWidth || document.documentElement.clientWidth || 0;
		if (w <= 768)
			return;
		this.trendChartPauseRefresh = true;
	},

	handleTrendMove: function (ev) {
		var canvas = this.el.trendCanvas;
		var tooltip = this.el.trendTooltip;
		if (!canvas || !this.trend.length || !canvas.__viewRange) return;
		var w = window.innerWidth || document.documentElement.clientWidth || 0;
		if (w > 768)
			this.trendChartPauseRefresh = true;
		var rect = canvas.getBoundingClientRect();
		var x = ev.clientX - rect.left;
		var padL = typeof canvas.__trendPadL === 'number' ? canvas.__trendPadL : 40;
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
		tooltip.innerHTML = this.buildTrendTooltipHtml(p);
		tooltip.style.display = 'block';
		tooltip.offsetHeight;
		var tw = tooltip.offsetWidth || 280;
		var th = tooltip.offsetHeight || 200;
		var tooltipX = ev.clientX + 20;
		var tooltipY = ev.clientY - th - 20;
		if (tooltipY < 0)
			tooltipY = ev.clientY + 20;
		if (tooltipX + tw > window.innerWidth)
			tooltipX = ev.clientX - tw - 20;
		if (tooltipX < 0)
			tooltipX = 10;
		if (tooltipY < 0)
			tooltipY = 10;
		if (tooltipY + th > window.innerHeight)
			tooltipY = window.innerHeight - th - 10;
		tooltip.style.left = tooltipX + 'px';
		tooltip.style.top = tooltipY + 'px';
	},

	handleTrendLeave: function () {
		this.trendChartPauseRefresh = false;
		this.chartHoverIndex = null;
		this.chartScale = 1;
		this.chartOffset = 0;
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
					E('td', {}, [ formatLimitKbpsRate(it.down_v4_kbps || 0) ]),
					E('td', {}, [ formatLimitKbpsRate(it.down_v6_kbps || 0) ]),
					E('td', {}, [ formatLimitKbpsRate(it.up_v4_kbps || 0) ]),
					E('td', {}, [ formatLimitKbpsRate(it.up_v6_kbps || 0) ]),
					E('td', {}, [ E('button', {
						'class': 'btn cbi-button cbi-button-remove',
						'click': function () { self.deleteIfaceLimit(it.iface); }
					}, [ _('Delete') ]) ])
				]));
			})(list[i]);
		}
	},

	renderGuestControlTable: function () {
		var self = this;
		var defaults = Array.isArray(this.rate.guestDefaults) ? this.rate.guestDefaults : [];
		var whitelist = Array.isArray(this.rate.guestWhitelist) ? this.rate.guestWhitelist : [];
		var rowsByIface = {};
		var ifaces = [];
		var i;

		for (i = 0; i < defaults.length; i++) {
			var it = defaults[i] || {};
			var iface = String(it.iface || '').trim();
			if (!iface) continue;
			if (!rowsByIface[iface]) {
				rowsByIface[iface] = { iface: iface, whitelist_count: 0 };
				ifaces.push(iface);
			}
			rowsByIface[iface].up_v4_kbps = asNum(it.up_v4_kbps);
			rowsByIface[iface].down_v4_kbps = asNum(it.down_v4_kbps);
			rowsByIface[iface].up_v6_kbps = asNum(it.up_v6_kbps);
			rowsByIface[iface].down_v6_kbps = asNum(it.down_v6_kbps);
			rowsByIface[iface].enabled = it.enabled == null ? true : !!it.enabled;
		}

		for (i = 0; i < whitelist.length; i++) {
			var w = whitelist[i] || {};
			var wiface = String(w.iface || '').trim();
			if (!wiface) continue;
			if (!rowsByIface[wiface]) continue;
			rowsByIface[wiface].whitelist_count++;
		}

		ifaces.sort();
		dom.content(this.el.guestRuleBody, []);
		if (!ifaces.length) {
			this.el.guestRuleBody.appendChild(E('tr', {}, [
				E('td', { 'colspan': '8', 'class': 'bplus-empty' }, [ _('(empty)') ])
			]));
			return;
		}

		for (i = 0; i < ifaces.length; i++) {
			(function (row) {
				self.el.guestRuleBody.appendChild(E('tr', {}, [
					E('td', {}, [ row.iface ]),
					E('td', {}, [ formatLimitKbpsRate(row.up_v4_kbps) ]),
					E('td', {}, [ formatLimitKbpsRate(row.down_v4_kbps) ]),
					E('td', {}, [ formatLimitKbpsRate(row.up_v6_kbps) ]),
					E('td', {}, [ formatLimitKbpsRate(row.down_v6_kbps) ]),
					E('td', {}, [ String(asNum(row.whitelist_count)) ]),
					E('td', {}, [
						E('span', { 'class': 'bplus-guest-enabled-pill ' + (row.enabled ? 'is-enabled' : 'is-disabled') }, [
							row.enabled ? _('Enabled') : _('Disabled')
						])
					]),
					E('td', {}, [
						E('button', {
							'class': 'btn cbi-button cbi-button-edit',
							'type': 'button',
							'click': function () { self.openGuestRuleModal(row.iface); }
						}, [ _('Edit') ]),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'type': 'button',
							'click': function () { self.deleteGuestDefault(row.iface); }
						}, [ _('Delete') ])
					])
				]));
			})(rowsByIface[ifaces[i]]);
		}
	},

	findGuestDefaultByIface: function (iface) {
		var target = String(iface || '').trim();
		if (!target) return null;
		var list = this.rate.guestDefaults || [];
		for (var i = 0; i < list.length; i++) {
			var it = list[i] || {};
			if (String(it.iface || '').trim() === target)
				return it;
		}
		return null;
	},

	findGuestWhitelistByIface: function (iface) {
		var target = String(iface || '').trim();
		var list = this.rate.guestWhitelist || [];
		var out = [];
		if (!target) return out;
		for (var i = 0; i < list.length; i++) {
			var it = list[i] || {};
			if (String(it.iface || '').trim() === target)
				out.push(it);
		}
		return out;
	},

	getGuestIfaceCandidates: function () {
		var map = {};
		var out = [];
		var pushIface = function (v) {
			var s = String(v || '').trim();
			if (!s || map[s]) return;
			map[s] = 1;
			out.push(s);
		};
		var i;
		for (i = 0; i < this.overview.length; i++)
			pushIface(this.overview[i] && this.overview[i].ifname);
		for (i = 0; i < this.rate.guestDefaults.length; i++)
			pushIface(this.rate.guestDefaults[i] && this.rate.guestDefaults[i].iface);
		for (i = 0; i < this.rate.guestWhitelist.length; i++)
			pushIface(this.rate.guestWhitelist[i] && this.rate.guestWhitelist[i].iface);
		out.sort();
		return out;
	},

	getGuestDefaultIfaceSet: function () {
		var set = {};
		var list = this.rate.guestDefaults || [];
		for (var i = 0; i < list.length; i++) {
			var iface = String((list[i] || {}).iface || '').trim();
			if (iface) set[iface] = 1;
		}
		return set;
	},

	syncGuestRuleIfaceOptions: function () {
		if (!this.el.guestRuleIface) return;
		var selected = String(this.el.guestRuleIface.value || '').trim();
		var ifaces;
		if (this.guestRuleModalMode === 'edit' && this.guestRuleEditingIface) {
			ifaces = [ this.guestRuleEditingIface ];
		} else {
			var all = this.getGuestIfaceCandidates();
			var used = this.getGuestDefaultIfaceSet();
			ifaces = all.filter(function (iface) { return !used[iface]; });
		}
		var rows = ifaces.map(function (x) { return { value: x, label: x }; });
		if (!hasSameSelectOptions(this.el.guestRuleIface, rows)) {
			if (document.activeElement === this.el.guestRuleIface)
				return;
			dom.content(this.el.guestRuleIface, []);
			for (var i = 0; i < ifaces.length; i++) {
				this.el.guestRuleIface.appendChild(E('option', { 'value': ifaces[i] }, [ ifaces[i] ]));
			}
		}
		if (selected && ifaces.indexOf(selected) >= 0)
			this.el.guestRuleIface.value = selected;
		else if (ifaces.length > 0)
			this.el.guestRuleIface.value = ifaces[0];
	},

	getGuestWhitelistMacCandidateRows: function (iface) {
		var target = String(iface || '').trim();
		var byMac = {};
		var add = function (mac, label) {
			var key = String(mac || '').toLowerCase().replace(/-/g, ':').trim();
			if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(key)) return;
			if (!byMac[key]) byMac[key] = String(label || key);
		};
		var i;
		for (i = 0; i < this.devices.length; i++) {
			var d = this.devices[i] || {};
			if (target && String(deviceIfaceName(d) || '').trim() !== target) continue;
			var hn = String(d.hostname || '').trim();
			if (!hn || hn === '-' || hn === '—') hn = '';
			var mac = this.normalizeMacKey(d.mac);
			add(mac, hn ? (hn + ' · ' + mac) : mac);
		}
		for (i = 0; i < this.rate.guestWhitelist.length; i++) {
			var w = this.rate.guestWhitelist[i] || {};
			if (target && String(w.iface || '').trim() !== target) continue;
			add(this.normalizeMacKey(w.mac), this.normalizeMacKey(w.mac));
		}
		for (i = 0; i < this.guestRuleWhitelist.length; i++) {
			var cur = this.normalizeMacKey(this.guestRuleWhitelist[i]);
			add(cur, byMac[cur] || cur);
		}
		var keys = Object.keys(byMac);
		keys.sort(function (a, b) {
			var la = String(byMac[a] || a);
			var lb = String(byMac[b] || b);
			return la.localeCompare(lb);
		});
		return keys.map(function (mac) {
			return { value: mac, label: String(byMac[mac] || mac) };
		});
	},

	syncGuestRuleWhitelistMacOptions: function (iface) {
		if (!this.el.guestRuleWhitelistInput) return;
		var selected = String(this.el.guestRuleWhitelistInput.value || '').trim();
		var items = this.getGuestWhitelistMacCandidateRows(iface);
		var rows = [ { value: '', label: _('Select MAC') } ].concat(items);
		if (!hasSameSelectOptions(this.el.guestRuleWhitelistInput, rows)) {
			if (document.activeElement === this.el.guestRuleWhitelistInput)
				return;
			dom.content(this.el.guestRuleWhitelistInput, []);
			for (var i = 0; i < rows.length; i++) {
				this.el.guestRuleWhitelistInput.appendChild(E('option', { 'value': rows[i].value }, [ rows[i].label ]));
			}
		}
		var ok = false;
		for (var j = 0; j < items.length; j++) {
			if (String(items[j].value) === selected) {
				ok = true;
				break;
			}
		}
		if (selected && ok)
			this.el.guestRuleWhitelistInput.value = selected;
		else
			this.el.guestRuleWhitelistInput.value = '';
	},

	setGuestRuleWhitelist: function (macList) {
		var map = {};
		var out = [];
		for (var i = 0; i < macList.length; i++) {
			var mac = this.normalizeMacKey(macList[i]);
			if (!mac || map[mac]) continue;
			map[mac] = 1;
			out.push(mac);
		}
		out.sort();
		this.guestRuleWhitelist = out;
		this.renderGuestRuleWhitelistEditor();
	},

	renderGuestRuleWhitelistEditor: function () {
		var self = this;
		dom.content(this.el.guestRuleWhitelistBody, []);
		if (!this.guestRuleWhitelist.length) {
			this.el.guestRuleWhitelistBody.appendChild(E('tr', {}, [
				E('td', { 'colspan': '3', 'class': 'bplus-empty' }, [ _('(empty)') ])
			]));
			return;
		}
		for (var i = 0; i < this.guestRuleWhitelist.length; i++) {
			(function (mac) {
				var hn = self.guestHostnameForMac(self.guestRuleEditingIface, mac) || '—';
				self.el.guestRuleWhitelistBody.appendChild(E('tr', {}, [
					E('td', {}, [ hn ]),
					E('td', { 'class': 'bplus-mono' }, [ mac ]),
					E('td', {}, [
						E('button', {
							'type': 'button',
							'class': 'btn cbi-button cbi-button-remove',
							'click': function () {
								var next = [];
								for (var j = 0; j < self.guestRuleWhitelist.length; j++) {
									if (self.guestRuleWhitelist[j] !== mac)
										next.push(self.guestRuleWhitelist[j]);
								}
								self.setGuestRuleWhitelist(next);
							}
						}, [ _('Delete') ])
					])
				]));
			})(this.guestRuleWhitelist[i]);
		}
	},

	guestHostnameForMac: function (iface, mac) {
		var targetIface = String(iface || '').trim();
		var targetMac = this.normalizeMacKey(mac);
		if (!targetMac) return '';
		for (var i = 0; i < this.devices.length; i++) {
			var d = this.devices[i] || {};
			if (targetIface && String(deviceIfaceName(d) || '').trim() !== targetIface)
				continue;
			if (this.normalizeMacKey(d.mac) !== targetMac)
				continue;
			var hn = String(d.hostname || '').trim();
			if (!hn || hn === '-' || hn === '—') return '';
			return hn;
		}
		return '';
	},

	fillGuestRuleFormForIface: function (iface) {
		var target = String(iface || '').trim();
		var current = this.findGuestDefaultByIface(target);
		var whitelist = this.findGuestWhitelistByIface(target);
		this.setRateLimitFieldFromKbps(current ? asNum(current.down_v4_kbps) : 0, this.el.guestRuleD4, this.el.guestRuleD4Unit);
		this.setRateLimitFieldFromKbps(current ? asNum(current.down_v6_kbps) : 0, this.el.guestRuleD6, this.el.guestRuleD6Unit);
		this.setRateLimitFieldFromKbps(current ? asNum(current.up_v4_kbps) : 0, this.el.guestRuleU4, this.el.guestRuleU4Unit);
		this.setRateLimitFieldFromKbps(current ? asNum(current.up_v6_kbps) : 0, this.el.guestRuleU6, this.el.guestRuleU6Unit);
		this.el.guestRuleEnabled.checked = current && current.enabled != null ? !!current.enabled : true;
		this.guestRuleEditingIface = target;
		this.setGuestRuleWhitelist(whitelist.map(function (it) { return String(it.mac || ''); }));
		this.syncGuestRuleWhitelistMacOptions(target);
	},

	showGuestRuleModal: function () {
		if (this.el.guestRuleOverlay)
			this.el.guestRuleOverlay.classList.add('show');
	},

	hideGuestRuleModal: function () {
		if (this.el.guestRuleOverlay)
			this.el.guestRuleOverlay.classList.remove('show');
		this.guestRuleModalMode = 'add';
		this.guestRuleEditingIface = '';
		this.guestRuleWhitelist = [];
	},

	openGuestRuleModal: function (iface) {
		var target = String(iface || '').trim();
		this.guestRuleModalMode = target ? 'edit' : 'add';
		this.guestRuleEditingIface = target || '';
		this.syncGuestRuleIfaceOptions();
		if (!target && this.el.guestRuleIface)
			target = String(this.el.guestRuleIface.value || '').trim();
		if (!target) {
			this.notifyError(_('All interfaces already have rules'), null);
			return;
		}
		this.el.guestRuleIface.disabled = this.guestRuleModalMode === 'edit';
		this.el.guestRuleIface.value = target;
		if (this.el.guestRuleModalTitle)
			this.el.guestRuleModalTitle.textContent = _('Guest rule') + ': ' + target;
		this.fillGuestRuleFormForIface(target);
		this.showGuestRuleModal();
	},

	addGuestRuleWhitelistFromInput: function () {
		var raw = String(this.el.guestRuleWhitelistInput.value || '').trim();
		if (!raw) return;
		var mac = this.normalizeMacKey(raw);
		if (!/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac)) {
			this.notifyError(_('Invalid MAC address'), null);
			return;
		}
		var next = this.guestRuleWhitelist.slice();
		if (next.indexOf(mac) < 0)
			next.push(mac);
		this.setGuestRuleWhitelist(next);
		this.syncGuestRuleWhitelistMacOptions(this.guestRuleEditingIface || this.el.guestRuleIface.value);
	},

	submitGuestRule: function (ev) {
		ev.preventDefault();
		var iface = String(this.el.guestRuleIface.value || '').trim();
		if (!iface) {
			this.notifyError(_('Iface is required'), null);
			return;
		}
		var existed = this.findGuestDefaultByIface(iface);
		if (existed && !(this.guestRuleModalMode === 'edit' && this.guestRuleEditingIface === iface)) {
			this.notifyError(_('Rule already exists for iface'), null);
			return;
		}
		var payload = {
			iface: iface,
			down_v4_kbps: this.getRateLimitFieldAsKbps(this.el.guestRuleD4, this.el.guestRuleD4Unit),
			down_v6_kbps: this.getRateLimitFieldAsKbps(this.el.guestRuleD6, this.el.guestRuleD6Unit),
			up_v4_kbps: this.getRateLimitFieldAsKbps(this.el.guestRuleU4, this.el.guestRuleU4Unit),
			up_v6_kbps: this.getRateLimitFieldAsKbps(this.el.guestRuleU6, this.el.guestRuleU6Unit)
		};
		var enabledPayload = {
			iface: iface,
			enabled: !!this.el.guestRuleEnabled.checked
		};

		var currentWhitelist = this.findGuestWhitelistByIface(iface);
		var currentMap = {};
		var nextMap = {};
		var i;
		for (i = 0; i < currentWhitelist.length; i++) {
			var curMac = this.normalizeMacKey(currentWhitelist[i] && currentWhitelist[i].mac);
			if (curMac) currentMap[curMac] = 1;
		}
		for (i = 0; i < this.guestRuleWhitelist.length; i++)
			nextMap[this.guestRuleWhitelist[i]] = 1;

		var reqs = [];
		reqs.push(callSetGuestDefault(payload).then(bplusJson).then(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'set guest default failed');
		}));
		reqs.push(callSetGuestDefaultEnabled(enabledPayload).then(bplusJson).then(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'set guest enable failed');
		}));

		for (var mac in nextMap) {
			if (!currentMap[mac]) {
				reqs.push(callAddGuestWhitelist({ iface: iface, mac: mac }).then(bplusJson).then(function (r) {
					if (r && r.ok === false) throw new Error(r.error || 'add whitelist failed');
				}));
			}
		}
		for (mac in currentMap) {
			if (!nextMap[mac]) {
				reqs.push(callRemoveGuestWhitelist({ iface: iface, mac: mac }).then(bplusJson).then(function (r) {
					if (r && r.ok === false) throw new Error(r.error || 'remove whitelist failed');
				}));
			}
		}

		Promise.all(reqs).then(L.bind(function () {
			return this.refreshRateData(false);
		}, this)).then(L.bind(function () {
			this.hideGuestRuleModal();
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to save guest rule'), e);
		}, this));
	},

	findIfaceLimitByIface: function (iface) {
		var target = String(iface || '').trim();
		if (!target) return null;
		var list = this.rate.ifaceLimits || [];
		for (var i = 0; i < list.length; i++) {
			var it = list[i];
			if (String(it.iface || '').trim() === target)
				return it;
		}
		return null;
	},

	showIfaceLimitModal: function () {
		if (this.el.ifaceLimitOverlay)
			this.el.ifaceLimitOverlay.classList.add('show');
	},

	hideIfaceLimitModal: function () {
		if (this.el.ifaceLimitOverlay)
			this.el.ifaceLimitOverlay.classList.remove('show');
		this.ifaceLimitEditingIface = '';
	},

	openIfaceLimitModal: function (iface) {
		var ifname = String(iface || '').trim();
		if (!ifname) return;
		this.ifaceLimitEditingIface = ifname;
		var cur = this.findIfaceLimitByIface(ifname);
		if (this.el.ifaceLimitModalTitle)
			this.el.ifaceLimitModalTitle.textContent = _('Set iface limit') + ': ' + ifname;
		this.el.ifaceLimitIfaceReadonly.value = ifname;
		this.setRateLimitFieldFromKbps(cur ? asNum(cur.down_v4_kbps) : 0, this.el.ifaceLimitD4Modal, this.el.ifaceLimitD4UnitModal);
		this.setRateLimitFieldFromKbps(cur ? asNum(cur.down_v6_kbps) : 0, this.el.ifaceLimitD6Modal, this.el.ifaceLimitD6UnitModal);
		this.setRateLimitFieldFromKbps(cur ? asNum(cur.up_v4_kbps) : 0, this.el.ifaceLimitU4Modal, this.el.ifaceLimitU4UnitModal);
		this.setRateLimitFieldFromKbps(cur ? asNum(cur.up_v6_kbps) : 0, this.el.ifaceLimitU6Modal, this.el.ifaceLimitU6UnitModal);
		this.showIfaceLimitModal();
	},

	showScheduleHubModal: function () {
		if (this.el.scheduleHubOverlay)
			this.el.scheduleHubOverlay.classList.add('show');
	},

	hideScheduleHubModal: function () {
		if (this.el.scheduleHubOverlay)
			this.el.scheduleHubOverlay.classList.remove('show');
	},

	showScheduleRuleModal: function () {
		if (this.el.scheduleRuleOverlay)
			this.el.scheduleRuleOverlay.classList.add('show');
	},

	hideScheduleRuleModal: function () {
		if (this.el.scheduleRuleOverlay)
			this.el.scheduleRuleOverlay.classList.remove('show');
	},

	normalizeMacKey: function (mac) {
		return String(mac || '').toLowerCase().replace(/-/g, ':').trim();
	},

	fillScheduleHubFromDevice: function (dev) {
		var hn = dev.hostname && dev.hostname !== '-' && String(dev.hostname).trim() ? String(dev.hostname) : '';
		var primary = hn || ((dev.ipv4 && dev.ipv4.length) ? dev.ipv4[0] : '') || (dev.mac || '—');
		var iface = deviceIfaceName(dev) || '—';
		var ip = (dev.ipv4 && dev.ipv4.length) ? dev.ipv4.join(', ') : '—';
		var v6 = (dev.ipv6 && dev.ipv6.length) ? dev.ipv6.join(', ') : '—';
		this.el.scheduleHubPrimary.textContent = primary;
		this.el.scheduleHubMeta.textContent =
			_('Iface') + ' ' + iface + ' · MAC ' + (dev.mac || '—') + ' · IPv4 ' + ip + ' · IPv6 ' + v6;
		this.el.scheduleHubHostnameInput.value = hn;
	},

	renderScheduleHubRulesList: function () {
		var wrap = this.el.scheduleHubRulesList;
		if (!wrap) return;
		var dev = this.scheduleHubDevice;
		dom.content(wrap, []);
		if (!dev) return;
		var mkey = this.normalizeMacKey(dev.mac);
		var iface = String(deviceIfaceName(dev) || '');
		var rules = (this.rate.schedules || []).filter(L.bind(function (r) {
			return this.normalizeMacKey(r.mac) === mkey && String(r.iface || '') === iface;
		}, this));
		if (!rules.length) {
			wrap.appendChild(E('div', { 'class': 'bplus-schedule-rules-empty' }, [ _('No scheduled rules yet; click Add rule.') ]));
			return;
		}
		var self = this;
		for (var i = 0; i < rules.length; i++) {
			(function (r) {
				var t = r.time_slot || {};
				var limits = scheduleRuleLimitsEl(r);
				var item = E('div', { 'class': 'bplus-schedule-rule-item' }, [
					E('div', { 'class': 'bplus-schedule-rule-info' }, [
						E('div', { 'class': 'bplus-schedule-rule-time' }, [ (t.start || '--:--') + ' – ' + (t.end || '--:--') ]),
						E('div', { 'class': 'bplus-schedule-rule-days' }, [ formatScheduleDayLabels(t.days) ]),
						limits
					]),
					E('div', { 'class': 'bplus-schedule-rule-actions' }, [
						E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-edit bplus-sch-rule-edit' }, [ _('Edit') ]),
						E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-remove bplus-sch-rule-delete' }, [ _('Delete') ])
					])
				]);
				item.querySelector('.bplus-sch-rule-edit').addEventListener('click', L.bind(self.openScheduleRuleModalForEdit, self, r));
				item.querySelector('.bplus-sch-rule-delete').addEventListener('click', L.bind(self.deleteSchedule, self, r.id));
				wrap.appendChild(item);
			})(rules[i]);
		}
	},

	submitScheduleHubHostname: function () {
		var dev = this.scheduleHubDevice;
		var hostname = this.el.scheduleHubHostnameInput.value.trim();
		if (!dev || !hostname) {
			this.notifyError(_('Hostname is required'), null);
			return;
		}
		var iface = String(deviceIfaceName(dev) || '').trim();
		var mac = String(dev.mac || '').trim();
		if (!iface || !mac) {
			this.notifyError(_('Iface and MAC are required'), null);
			return;
		}
		callSetDeviceHostname(iface, mac, hostname).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'hostname failed');
			dev.hostname = hostname;
			this.fillScheduleHubFromDevice(dev);
			return this.refreshLive(true).then(L.bind(function () {
				this.renderDevicesTable();
			}, this));
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to save hostname'), e);
		}, this));
	},

	openScheduleHub: function (dev) {
		this.scheduleHubDevice = dev;
		this.hideScheduleRuleModal();
		this.resetScheduleForm();
		this.fillScheduleHubFromDevice(dev);
		this.renderScheduleHubRulesList();
		this.el.scheduleHubTitle.textContent = _('Schedule rules');
		this.showScheduleHubModal();
	},

	openScheduleModalAdd: function () {
		ui.addNotification(null, E('p', {}, [ _('Open a device from the device table and use Settings to manage rules.') ]));
	},

	openScheduleModalForDevice: function (dev) {
		this.openScheduleHub(dev);
	},

	openScheduleRuleModalAdd: function () {
		if (!this.scheduleHubDevice) return;
		this.resetScheduleForm();
		this.el.scheduleRuleTitle.textContent = _('Add schedule rule');
		this.el.schSave.textContent = _('Add');
		this.showScheduleRuleModal();
	},

	openScheduleRuleModalForEdit: function (r) {
		this.applyScheduleRuleToForm(r);
		this.el.scheduleRuleTitle.textContent = _('Edit schedule rule');
		this.el.schSave.textContent = _('Update schedule');
		this.showScheduleRuleModal();
	},

	applyScheduleRuleToForm: function (r) {
		var t = r.time_slot || {};
		this.scheduleEditingId = String(r.id);
		this.el.schStart.value = t.start || '09:00';
		this.el.schEnd.value = t.end || '18:00';
		var daySet = {};
		var daysArr = t.days || [];
		for (var qd = 0; qd < daysArr.length; qd++) {
			daySet[String(daysArr[qd])] = true;
		}
		for (var di = 0; di < this.scheduleDayButtonList.length; di++) {
			var btn = this.scheduleDayButtonList[di];
			var num = asNum(btn.getAttribute('data-day'));
			if (daySet[String(num)]) btn.classList.add('active');
			else btn.classList.remove('active');
		}
		this.setRateLimitFieldFromKbps(r.down_v4_kbps || 0, this.el.schD4, this.el.schD4Unit);
		this.setRateLimitFieldFromKbps(r.down_v6_kbps || 0, this.el.schD6, this.el.schD6Unit);
		this.setRateLimitFieldFromKbps(r.up_v4_kbps || 0, this.el.schU4, this.el.schU4Unit);
		this.setRateLimitFieldFromKbps(r.up_v6_kbps || 0, this.el.schU6, this.el.schU6Unit);
		this.el.schSave.textContent = _('Update schedule');
	},

	resetScheduleForm: function () {
		this.scheduleEditingId = null;
		this.el.schSave.textContent = _('Add');
		for (var di = 0; di < this.scheduleDayButtonList.length; di++) {
			var btn = this.scheduleDayButtonList[di];
			var num = asNum(btn.getAttribute('data-day'));
			if (num >= 1 && num <= 5) btn.classList.add('active');
			else btn.classList.remove('active');
		}
		this.el.schStart.value = '09:00';
		this.el.schEnd.value = '18:00';
		this.setRateLimitFieldFromKbps(0, this.el.schD4, this.el.schD4Unit, 'm');
		this.setRateLimitFieldFromKbps(0, this.el.schD6, this.el.schD6Unit, 'm');
		this.setRateLimitFieldFromKbps(0, this.el.schU4, this.el.schU4Unit, 'm');
		this.setRateLimitFieldFromKbps(0, this.el.schU6, this.el.schU6Unit, 'm');
	},

	closeScheduleHubAll: function () {
		this.hideScheduleDeleteConfirm();
		this.hideScheduleRuleModal();
		this.hideScheduleHubModal();
		this.scheduleHubDevice = null;
		this.resetScheduleForm();
	},

	showScheduleDeleteConfirm: function (id) {
		this.pendingDeleteScheduleId = String(id);
		if (this.el.scheduleDeleteConfirmOverlay)
			this.el.scheduleDeleteConfirmOverlay.classList.add('show');
	},

	hideScheduleDeleteConfirm: function () {
		this.pendingDeleteScheduleId = null;
		if (this.el.scheduleDeleteConfirmOverlay)
			this.el.scheduleDeleteConfirmOverlay.classList.remove('show');
	},

	deleteSchedule: function (id) {
		this.showScheduleDeleteConfirm(id);
	},

	runDeleteScheduleConfirmed: function () {
		var id = this.pendingDeleteScheduleId;
		this.hideScheduleDeleteConfirm();
		if (!id) return;
		callDeleteSchedule(id).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'delete failed');
			return this.refreshRateData(false);
		}, this)).then(L.bind(function () {
			if (this.el.scheduleHubOverlay && this.el.scheduleHubOverlay.classList.contains('show'))
				this.renderScheduleHubRulesList();
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to delete schedule'), e);
		}, this));
	},

	deleteIfaceLimit: function (iface) {
		if (!iface || !confirm(_('Delete iface limit?'))) return;
		callDeleteIfaceLimit(String(iface)).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'delete failed');
			return this.refreshRateData(false).then(L.bind(function () {
				this.renderOverviewGrid();
			}, this));
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
		for (var di = 0; di < this.scheduleDayButtonList.length; di++) {
			var b = this.scheduleDayButtonList[di];
			if (b.classList.contains('active'))
				days.push(asNum(b.getAttribute('data-day')));
		}
		days.sort(function (a, b) { return a - b; });
		if (!days.length) {
			this.notifyError(_('Invalid days'), null);
			return;
		}
		var dev = this.scheduleHubDevice;
		if (!dev) {
			this.notifyError(_('No device context'), null);
			return;
		}
		var iface = String(deviceIfaceName(dev) || '').trim();
		var mac = String(dev.mac || '').trim();
		if (!iface || !mac) {
			this.notifyError(_('Iface and MAC are required'), null);
			return;
		}
		var payload = {
			iface: iface,
			mac: mac,
			time_slot: {
				start: this.el.schStart.value || '00:00',
				end: this.el.schEnd.value || '23:59',
				days: days
			},
			down_v4_kbps: this.getRateLimitFieldAsKbps(this.el.schD4, this.el.schD4Unit),
			down_v6_kbps: this.getRateLimitFieldAsKbps(this.el.schD6, this.el.schD6Unit),
			up_v4_kbps: this.getRateLimitFieldAsKbps(this.el.schU4, this.el.schU4Unit),
			up_v6_kbps: this.getRateLimitFieldAsKbps(this.el.schU6, this.el.schU6Unit)
		};

		var req = this.scheduleEditingId ?
			callUpdateSchedule([ this.scheduleEditingId, payload ]) :
			callCreateSchedule(payload);

		req.then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'submit failed');
			this.hideScheduleRuleModal();
			this.resetScheduleForm();
			return this.refreshRateData(false);
		}, this)).then(L.bind(function () {
			if (this.el.scheduleHubOverlay && this.el.scheduleHubOverlay.classList.contains('show'))
				this.renderScheduleHubRulesList();
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
		this.saveIfaceLimitPayload(payload);
	},

	submitIfaceLimitFromModal: function (ev) {
		ev.preventDefault();
		var payload = {
			iface: String(this.ifaceLimitEditingIface || '').trim(),
			down_v4_kbps: this.getRateLimitFieldAsKbps(this.el.ifaceLimitD4Modal, this.el.ifaceLimitD4UnitModal),
			down_v6_kbps: this.getRateLimitFieldAsKbps(this.el.ifaceLimitD6Modal, this.el.ifaceLimitD6UnitModal),
			up_v4_kbps: this.getRateLimitFieldAsKbps(this.el.ifaceLimitU4Modal, this.el.ifaceLimitU4UnitModal),
			up_v6_kbps: this.getRateLimitFieldAsKbps(this.el.ifaceLimitU6Modal, this.el.ifaceLimitU6UnitModal)
		};
		this.saveIfaceLimitPayload(payload).then(L.bind(function (ok) {
			if (ok) this.hideIfaceLimitModal();
		}, this));
	},

	saveIfaceLimitPayload: function (payload) {
		if (!payload.iface) {
			this.notifyError(_('Iface is required'), null);
			return Promise.resolve(false);
		}
		return callSetIfaceLimit(payload).then(bplusJson).then(L.bind(function (r) {
			if (r && r.ok === false) throw new Error(r.error || 'set failed');
			return this.refreshRateData(false).then(L.bind(function () {
				this.renderOverviewGrid();
				return true;
			}, this));
		}, this)).catch(L.bind(function (e) {
			this.notifyError(_('Failed to save iface limit'), e);
			return false;
		}, this));
	},

	syncRateFormIfaceOptions: function () {
		var ifaceList = this.overview.map(function (x) {
			return String(x.ifname || '').trim();
		}).filter(function (x) { return !!x; });
		dom.content(this.el.ifLimitIfaceList, []);
		for (var i = 0; i < ifaceList.length; i++)
			this.el.ifLimitIfaceList.appendChild(E('option', { 'value': ifaceList[i] }, [ ifaceList[i] ]));
		this.syncGuestRuleIfaceOptions();
		this.syncGuestRuleWhitelistMacOptions(this.el.guestRuleIface && this.el.guestRuleIface.value);
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
		var ph = h - pad.t - pad.b;
		var valsUp = [];
		var valsDown = [];
		var maxV = 1;
		for (var vi = 0; vi < data.length; vi++) {
			var row0 = data[vi];
			var u = sumUpBytes(row0);
			var d = sumDownBytes(row0);
			valsUp.push(u);
			valsDown.push(d);
			var tot = u + d;
			if (tot > maxV) maxV = tot;
		}

		ctx.fillStyle = '#8a8a8a';
		ctx.font = '11px sans-serif';
		var maxLabelW = 0;
		for (var swI = 0; swI <= 4; swI++) {
			var tickV = maxV * (1 - swI / 4);
			var mw = ctx.measureText(formatBytes(tickV)).width;
			if (mw > maxLabelW) maxLabelW = mw;
		}
		pad.l = Math.max(56, Math.ceil(maxLabelW) + 22);
		var minPlotW = 80;
		if (pad.l + pad.r + minPlotW > w) pad.l = Math.max(40, w - pad.r - minPlotW);
		var pw = w - pad.l - pad.r;
		canvas.__statsPadL = pad.l;

		ctx.strokeStyle = 'rgba(130,130,130,0.28)';
		for (var gy = 0; gy <= 4; gy++) {
			var y = pad.t + ph * gy / 4;
			ctx.beginPath();
			ctx.moveTo(pad.l, y);
			ctx.lineTo(w - pad.r, y);
			ctx.stroke();
		}
		ctx.textAlign = 'right';
		for (var ty = 0; ty <= 4; ty++) {
			var value = maxV * (1 - ty / 4);
			ctx.fillText(formatBytes(value), pad.l - 10, pad.t + ph * ty / 4 + 4);
		}

		function px(v) { return Math.round(v); }
		function pxStroke(v) { return Math.round(v) + 0.5; }

		var barW = pw / data.length;
		var baseY = pad.t + ph;
		var statsColors = getTrafficThemeColors(this.root);
		canvas.__bars = [];
		for (var b = 0; b < data.length; b++) {
			var upV = valsUp[b];
			var downV = valsDown[b];
			var totalV = upV + downV;
			var downH = maxV > 0 ? ph * downV / maxV : 0;
			var upH = maxV > 0 ? ph * upV / maxV : 0;
			var totalH = downH + upH;
			var bx = pad.l + b * barW + Math.max(1, barW * 0.12);
			var bw = Math.max(1, barW * 0.76);
			var by = baseY - totalH;

			if (downH > 0) {
				var rxY = baseY - downH;
				ctx.fillStyle = statsColors.down;
				ctx.fillRect(px(bx), px(rxY), px(bw), px(downH));
				ctx.strokeStyle = statsColors.down;
				ctx.lineWidth = 1;
				ctx.strokeRect(pxStroke(bx), pxStroke(rxY), px(bw), px(downH));
			}
			if (upH > 0) {
				var txY = baseY - totalH;
				ctx.fillStyle = statsColors.up;
				ctx.fillRect(px(bx), px(txY), px(bw), px(upH));
				ctx.strokeStyle = statsColors.up;
				ctx.lineWidth = 1;
				ctx.strokeRect(pxStroke(bx), pxStroke(txY), px(bw), px(upH));
			}

			canvas.__bars.push({ x: bx, y: by, w: bw, h: totalH, index: b, value: totalV });
		}

		if (data.length) {
			ctx.fillStyle = '#8a8a8a';
			ctx.textAlign = 'left';
			ctx.fillText(new Date(data[0].start_ts_ms).toLocaleDateString(), pad.l, h - 8);
			ctx.textAlign = 'right';
			ctx.fillText(new Date(data[data.length - 1].start_ts_ms).toLocaleDateString(), w - pad.r, h - 8);
		}
	},

	buildStatsHistogramTooltipHtml: function (row) {
		var startMs = asNum(row.start_ts_ms);
		var endMs = row.end_ts_ms != null ? asNum(row.end_ts_ms) : startMs;
		var timeStr = formatStatsHistTooltipTimeRange(startMs, endMs);
		var upB = sumUpBytes(row);
		var downB = sumDownBytes(row);
		var html = '<div class="traffic-increments-tooltip-title">' + timeStr + '</div>';
		html += '<div class="ht-kpis">' +
			'<div class="ht-kpi up"><div class="ht-k-label">' + _('Upload') + '</div><div class="ht-k-value">' + formatBytes(upB) + '</div></div>' +
			'<div class="ht-kpi down"><div class="ht-k-label">' + _('Download') + '</div><div class="ht-k-value">' + formatBytes(downB) + '</div></div>' +
			'</div>';
		html += '<div class="ht-divider"></div>';

		function familyBlock(familyTitle, upBytes, downBytes, upAvg, upP95, upMax, upMin, downAvg, downP95, downMax, downMin) {
			var b = '<div class="traffic-increments-tooltip-section bplus-hist-tooltip-col">';
			b += '<div class="traffic-increments-tooltip-section-title">' + familyTitle + '</div>';
			b += '<div class="ht-kpis">' +
				'<div class="ht-kpi up"><div class="ht-k-label">' + _('Upload') + '</div><div class="ht-k-value">' + formatBytes(upBytes) + '</div></div>' +
				'<div class="ht-kpi down"><div class="ht-k-label">' + _('Download') + '</div><div class="ht-k-value">' + formatBytes(downBytes) + '</div></div>' +
				'</div>';
			b += '<div class="ht-divider"></div>';
			b += '<div class="ht-section-title">' + _('Upload Statistics') + '</div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Average') + '</span><span class="ht-val">' + formatBpsAsByteRate(upAvg) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('P95') + '</span><span class="ht-val">' + formatBpsAsByteRate(upP95) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Maximum') + '</span><span class="ht-val">' + formatBpsAsByteRate(upMax) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Minimum') + '</span><span class="ht-val">' + formatBpsAsByteRate(upMin) + '</span></div>';
			b += '<div class="ht-section-title bplus-hist-tooltip-dlstats-title">' + _('Download Statistics') + '</div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Average') + '</span><span class="ht-val">' + formatBpsAsByteRate(downAvg) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('P95') + '</span><span class="ht-val">' + formatBpsAsByteRate(downP95) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Maximum') + '</span><span class="ht-val">' + formatBpsAsByteRate(downMax) + '</span></div>';
			b += '<div class="ht-row"><span class="ht-key">' + _('Minimum') + '</span><span class="ht-val">' + formatBpsAsByteRate(downMin) + '</span></div>';
			b += '</div>';
			return b;
		}

		html += '<div class="bplus-hist-tooltip-families">';
		html += familyBlock(_('IPv4'), asNum(row.up_v4_bytes), asNum(row.down_v4_bytes),
			row.up_v4_bps_avg, row.up_v4_bps_p95, row.up_v4_bps_max, row.up_v4_bps_min,
			row.down_v4_bps_avg, row.down_v4_bps_p95, row.down_v4_bps_max, row.down_v4_bps_min);
		html += familyBlock(_('IPv6'), asNum(row.up_v6_bytes), asNum(row.down_v6_bytes),
			row.up_v6_bps_avg, row.up_v6_bps_p95, row.up_v6_bps_max, row.up_v6_bps_min,
			row.down_v6_bps_avg, row.down_v6_bps_p95, row.down_v6_bps_max, row.down_v6_bps_min);
		html += '</div>';
		return html;
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
		tip.innerHTML = this.buildStatsHistogramTooltipHtml(row);
		tip.style.display = 'block';
		tip.offsetHeight;
		var tw = tip.offsetWidth || 280;
		var th = tip.offsetHeight || 200;
		var tooltipX = ev.clientX + 20;
		var tooltipY = ev.clientY - th - 20;
		if (tooltipY < 0)
			tooltipY = ev.clientY + 20;
		if (tooltipX + tw > window.innerWidth)
			tooltipX = ev.clientX - tw - 20;
		if (tooltipX < 0)
			tooltipX = 10;
		if (tooltipY < 0)
			tooltipY = 10;
		if (tooltipY + th > window.innerHeight)
			tooltipY = window.innerHeight - th - 10;
		tip.style.left = tooltipX + 'px';
		tip.style.top = tooltipY + 'px';
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
		var reqSeq = ++this.statsReqSeq;

		var macF = this.el.statsMacSelect ? (this.el.statsMacSelect.value || '').trim() : '';
		var tt = this.el.statsTrafficTypeSelect ? (this.el.statsTrafficTypeSelect.value || 'all') : 'all';
		if (tt === 'all') tt = '';
		var chunks = buildStatsHistogramChunks(start, end, bucket);
		if (chunks && chunks.length > 1)
			this.setStatsLoadingNotice(_('Loading in chunks, please wait... (%d/%d)').format(0, chunks.length));
		else
			this.setStatsLoadingNotice(_('Loading...'));

		fetchStatsHistogramChunked(iface, macF, tt || 'all', start, end, bucket, L.bind(function (done, total) {
			if (reqSeq !== this.statsReqSeq) return;
			if (total <= 1) return;
			this.setStatsLoadingNotice(_('Loading in chunks, please wait... (%d/%d)').format(done, total));
		}, this))
			.then(L.bind(function (res) {
				if (reqSeq !== this.statsReqSeq) return;
				this.histogram = res || [];
				this.drawStatsChart();
				this.updateStatsHistogramSummary();
				this.updateStatsHistogramTimeline();
				this.setStatsLoadingNotice('');
			}, this))
			.catch(L.bind(function (e) {
				if (reqSeq !== this.statsReqSeq) return;
				this.notifyError(_('Failed to query statistics'), e);
				this.setStatsLoadingNotice('');
			}, this))
			.then(L.bind(function () {
				if (reqSeq !== this.statsReqSeq) return;
				this.setBusy(this.el.statsQuery, false);
			}, this), L.bind(function () {
				if (reqSeq !== this.statsReqSeq) return;
				this.setBusy(this.el.statsQuery, false);
				this.setStatsLoadingNotice('');
			}, this));
	},

	queryUsageRanking: function () {
		var iface = this.el.rankIface.value;
		var start = dateStartMs(this.el.rankStart.value);
		var end = dateEndMs(this.el.rankEnd.value);
		if (!iface) {
			this.notifyError(_('Please choose an interface'), null);
			return;
		}
		if (start == null || end == null || end < start) {
			this.notifyError(_('Invalid date range'), null);
			return;
		}
		this.setBusy(this.el.rankQuery, true);
		var rankTt = this.el.rankTrafficTypeSelect ? (this.el.rankTrafficTypeSelect.value || 'all') : 'all';
		if (rankTt === 'all') rankTt = '';

		callGetUsageRanking(iface, rankTt || 'all', String(start), String(end), '0')
			.then(function (r) { return unwrapData(r, []); })
			.then(L.bind(function (res) {
				this.usageRanking = res || [];
				this.renderUsageRanking();
				this.updateRankTimeline();
			}, this))
			.catch(L.bind(function (e) {
				this.notifyError(_('Failed to query usage ranking'), e);
			}, this))
			.then(L.bind(function () {
				this.setBusy(this.el.rankQuery, false);
			}, this), L.bind(function () {
				this.setBusy(this.el.rankQuery, false);
			}, this));
	},

	applyRankPreset: function (kind, runQuery) {
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var todayMs = today.getTime();
		var start, end;

		switch (kind) {
		case 'today':
			start = new Date(today);
			end = new Date(today);
			break;
		case 'thisweek':
			var dayOfWeek = now.getDay();
			var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			start = new Date(todayMs + mondayOffset * 86400000);
			start.setHours(0, 0, 0, 0);
			end = new Date(today);
			break;
		case 'lastweek':
			var lastWeekDayOfWeek = now.getDay();
			var lastWeekMondayOffset = lastWeekDayOfWeek === 0 ? -13 : -6 - lastWeekDayOfWeek;
			start = new Date(todayMs + lastWeekMondayOffset * 86400000);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setDate(end.getDate() + 6);
			break;
		case 'thismonth':
			start = new Date(now.getFullYear(), now.getMonth(), 1);
			end = new Date(today);
			break;
		case 'lastmonth':
			var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
			end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
			break;
		case '7days':
			start = new Date(todayMs - 6 * 86400000);
			end = new Date(today);
			break;
		case '30days':
			start = new Date(todayMs - 29 * 86400000);
			end = new Date(today);
			break;
		case '90days':
			start = new Date(todayMs - 89 * 86400000);
			end = new Date(today);
			break;
		case '1year':
			start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			end = new Date(today);
			break;
		default:
			return;
		}

		this.el.rankStart.value = formatDateInput(start);
		this.el.rankEnd.value = formatDateInput(end);

		var presetPairs = [
			['today', this.el.rankPresetToday],
			['thisweek', this.el.rankPresetThisWeek],
			['lastweek', this.el.rankPresetLastWeek],
			['thismonth', this.el.rankPresetThisMonth],
			['lastmonth', this.el.rankPresetLastMonth],
			['7days', this.el.rankPreset7Days],
			['30days', this.el.rankPreset30Days],
			['90days', this.el.rankPreset90Days],
			['1year', this.el.rankPreset1Year]
		];
		for (var pi = 0; pi < presetPairs.length; pi++) {
			var active = presetPairs[pi][0] === kind;
			presetPairs[pi][1].className = 'cbi-button cbi-button-' + (active ? 'positive' : 'neutral');
		}
		this.updateRankTimeline();
		if (runQuery)
			this.queryUsageRanking();
	},

	applyStatsPreset: function (kind, runQuery) {
		var now = new Date();
		var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		var todayMs = today.getTime();
		var start, end;

		switch (kind) {
		case 'today':
			start = new Date(today);
			end = new Date(today);
			break;
		case 'thisweek':
			var dayOfWeek = now.getDay();
			var mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			start = new Date(todayMs + mondayOffset * 86400000);
			start.setHours(0, 0, 0, 0);
			end = new Date(today);
			break;
		case 'lastweek':
			var lastWeekDayOfWeek = now.getDay();
			var lastWeekMondayOffset = lastWeekDayOfWeek === 0 ? -13 : -6 - lastWeekDayOfWeek;
			start = new Date(todayMs + lastWeekMondayOffset * 86400000);
			start.setHours(0, 0, 0, 0);
			end = new Date(start);
			end.setDate(end.getDate() + 6);
			break;
		case 'thismonth':
			start = new Date(now.getFullYear(), now.getMonth(), 1);
			end = new Date(today);
			break;
		case 'lastmonth':
			var lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
			end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
			break;
		case '7days':
			start = new Date(todayMs - 6 * 86400000);
			end = new Date(today);
			break;
		case '30days':
			start = new Date(todayMs - 29 * 86400000);
			end = new Date(today);
			break;
		case '90days':
			start = new Date(todayMs - 89 * 86400000);
			end = new Date(today);
			break;
		case '1year':
			start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
			end = new Date(today);
			break;
		default:
			return;
		}

		this.el.statsStart.value = formatDateInput(start);
		this.el.statsEnd.value = formatDateInput(end);

		var presetPairs = [
			['today', this.el.presetToday],
			['thisweek', this.el.presetThisWeek],
			['lastweek', this.el.presetLastWeek],
			['thismonth', this.el.presetThisMonth],
			['lastmonth', this.el.presetLastMonth],
			['7days', this.el.preset7Days],
			['30days', this.el.preset30Days],
			['90days', this.el.preset90Days],
			['1year', this.el.preset1Year]
		];
		for (var pi = 0; pi < presetPairs.length; pi++) {
			var active = presetPairs[pi][0] === kind;
			presetPairs[pi][1].className = 'cbi-button cbi-button-' + (active ? 'positive' : 'neutral');
		}
		this.updateStatsHistogramTimeline();
		if (runQuery)
			this.queryStats();
	},

	bindEvents: function () {
		this.el.rateUnitBtnByte.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.setRateUnitMode('byte', true);
			this.refreshRateUnitDisplays();
		}, this));
		this.el.rateUnitBtnBit.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.setRateUnitMode('bit', true);
			this.refreshRateUnitDisplays();
		}, this));

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

		if (this.el.devicesIfaceSelect) {
			this.el.devicesIfaceSelect.addEventListener('change', L.bind(function () {
				this.devicesFilterIface = this.el.devicesIfaceSelect.value || '';
				this.refreshLive(true);
			}, this));
		}

		if (this.el.deviceModeSelect) {
			this.el.deviceModeSelect.addEventListener('change', L.bind(function () {
				this.deviceDisplayMode = this.el.deviceModeSelect.value;
				localStorage.setItem('bplus_device_display_mode', this.deviceDisplayMode);
				this.renderDevicesTable();
			}, this));
		}

		this.el.deviceBody.addEventListener('click', L.bind(function (ev) {
			var btn = ev.target.closest('.bplus-device-settings-btn');
			if (!btn || !this.el.deviceBody.contains(btn)) return;
			ev.preventDefault();
			var dev = this.findDeviceForScheduleClick(btn.getAttribute('data-bplus-mac'), btn.getAttribute('data-bplus-iface'));
			this.openScheduleModalForDevice(dev);
		}, this));

		this.el.overviewGrid.addEventListener('click', L.bind(function (ev) {
			var btn = ev.target.closest('.bplus-overview-limit-btn');
			if (!btn || !this.el.overviewGrid.contains(btn)) return;
			ev.preventDefault();
			this.openIfaceLimitModal(btn.getAttribute('data-iface'));
		}, this));

		if (this.el.statsIface) {
			this.el.statsIface.addEventListener('change', L.bind(function () {
				this.renderStatsMacOptions();
				this.queryStatsIfIfaceSelected();
			}, this));
		}

		if (this.el.rankIface) {
			this.el.rankIface.addEventListener('change', L.bind(function () {
				this.queryUsageRankingIfIfaceSelected();
			}, this));
		}
		if (this.el.rankTrafficTypeSelect) {
			this.el.rankTrafficTypeSelect.addEventListener('change', L.bind(this.queryUsageRankingIfIfaceSelected, this));
		}
		if (this.el.statsTrafficTypeSelect) {
			this.el.statsTrafficTypeSelect.addEventListener('change', L.bind(this.queryStatsIfIfaceSelected, this));
		}
		if (this.el.statsBucket) {
			this.el.statsBucket.addEventListener('change', L.bind(this.queryStatsIfIfaceSelected, this));
		}
		if (this.el.statsMacSelect) {
			this.el.statsMacSelect.addEventListener('change', L.bind(this.queryStatsIfIfaceSelected, this));
		}

		this.el.trendCanvas.addEventListener('mouseenter', L.bind(this.handleTrendEnter, this));
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
			this.hideScheduleRuleModal();
		}, this));
		this.el.scheduleRuleDismiss.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideScheduleRuleModal();
		}, this));
		this.el.scheduleHubCloseBtn.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.closeScheduleHubAll();
		}, this));
		this.el.scheduleDeleteConfirmCancel.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideScheduleDeleteConfirm();
		}, this));
		this.el.scheduleDeleteConfirmOk.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.runDeleteScheduleConfirmed();
		}, this));
		this.el.ifaceLimitForm.addEventListener('submit', L.bind(this.submitIfaceLimit, this));
		this.el.ifaceLimitModalForm.addEventListener('submit', L.bind(this.submitIfaceLimitFromModal, this));
		this.el.ifaceLimitModalCancel.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideIfaceLimitModal();
		}, this));
		this.el.ifaceLimitModalDismiss.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideIfaceLimitModal();
		}, this));
		this.el.guestPolicyAddRuleBtn.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.openGuestRuleModal('');
		}, this));
		this.el.guestRuleModalCancel.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideGuestRuleModal();
		}, this));
		this.el.guestRuleModalDismiss.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.hideGuestRuleModal();
		}, this));
		this.el.guestRuleForm.addEventListener('submit', L.bind(this.submitGuestRule, this));
		this.el.guestRuleWhitelistAdd.addEventListener('click', L.bind(function (ev) {
			ev.preventDefault();
			this.addGuestRuleWhitelistFromInput();
		}, this));
		this.el.guestRuleIface.addEventListener('change', L.bind(function () {
			var iface = String(this.el.guestRuleIface.value || '').trim();
			if (!iface) return;
			if (this.el.guestRuleModalTitle)
				this.el.guestRuleModalTitle.textContent = _('Guest rule') + ': ' + iface;
			this.fillGuestRuleFormForIface(iface);
			this.syncGuestRuleWhitelistMacOptions(iface);
		}, this));
		var bindUnitSelect = L.bind(function (sel, inputEl) {
			if (!sel) return;
			sel.addEventListener('change', L.bind(function () {
				this.onRateLimitUnitSelectChanged(sel, inputEl);
			}, this));
		}, this);
		bindUnitSelect(this.el.schD4Unit, this.el.schD4);
		bindUnitSelect(this.el.schD6Unit, this.el.schD6);
		bindUnitSelect(this.el.schU4Unit, this.el.schU4);
		bindUnitSelect(this.el.schU6Unit, this.el.schU6);
		bindUnitSelect(this.el.ifaceLimitD4UnitModal, this.el.ifaceLimitD4Modal);
		bindUnitSelect(this.el.ifaceLimitD6UnitModal, this.el.ifaceLimitD6Modal);
		bindUnitSelect(this.el.ifaceLimitU4UnitModal, this.el.ifaceLimitU4Modal);
		bindUnitSelect(this.el.ifaceLimitU6UnitModal, this.el.ifaceLimitU6Modal);
		bindUnitSelect(this.el.guestRuleD4Unit, this.el.guestRuleD4);
		bindUnitSelect(this.el.guestRuleD6Unit, this.el.guestRuleD6);
		bindUnitSelect(this.el.guestRuleU4Unit, this.el.guestRuleU4);
		bindUnitSelect(this.el.guestRuleU6Unit, this.el.guestRuleU6);

		this.el.statsQuery.addEventListener('click', L.bind(this.queryStats, this));
		this.el.statsReset.addEventListener('click', L.bind(function () {
			this.applyStatsPreset('1year', true);
		}, this));
		this.el.statsStart.addEventListener('change', L.bind(this.updateStatsHistogramTimeline, this));
		this.el.statsEnd.addEventListener('change', L.bind(this.updateStatsHistogramTimeline, this));
		var self = this;
		[
			['today', this.el.presetToday],
			['thisweek', this.el.presetThisWeek],
			['lastweek', this.el.presetLastWeek],
			['thismonth', this.el.presetThisMonth],
			['lastmonth', this.el.presetLastMonth],
			['7days', this.el.preset7Days],
			['30days', this.el.preset30Days],
			['90days', this.el.preset90Days],
			['1year', this.el.preset1Year]
		].forEach(function (row) {
			var presetKind = row[0];
			row[1].addEventListener('click', function () {
				self.applyStatsPreset(presetKind, true);
			});
		});

		this.el.rankQuery.addEventListener('click', L.bind(this.queryUsageRanking, this));
		this.el.rankReset.addEventListener('click', L.bind(function () {
			this.applyRankPreset('1year', true);
		}, this));
		this.el.rankStart.addEventListener('change', L.bind(this.updateRankTimeline, this));
		this.el.rankEnd.addEventListener('change', L.bind(this.updateRankTimeline, this));
		[
			['today', this.el.rankPresetToday],
			['thisweek', this.el.rankPresetThisWeek],
			['lastweek', this.el.rankPresetLastWeek],
			['thismonth', this.el.rankPresetThisMonth],
			['lastmonth', this.el.rankPresetLastMonth],
			['7days', this.el.rankPreset7Days],
			['30days', this.el.rankPreset30Days],
			['90days', this.el.rankPreset90Days],
			['1year', this.el.rankPreset1Year]
		].forEach(function (row) {
			var presetKind = row[0];
			row[1].addEventListener('click', function () {
				self.applyRankPreset(presetKind, true);
			});
		});

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
		this.el.rateUnitBtnByte = E('button', { 'type': 'button', 'class': 'bplus-unit-btn' }, [ 'B/s' ]);
		this.el.rateUnitBtnBit = E('button', { 'type': 'button', 'class': 'bplus-unit-btn' }, [ 'bps' ]);
		this.el.rateUnitToggle = E('div', { 'class': 'bplus-rate-unit-toggle', 'title': _('Rate unit') }, [
			this.el.rateUnitBtnByte,
			this.el.rateUnitBtnBit
		]);

		this.el.ifaceSelect = E('select', { 'class': 'cbi-input-select' });
		this.el.trendDeviceSelect = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '' }, [ _('All Devices') ]) ]);
		this.el.trendTypeSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'ipv4' }, [ 'IPv4' ]),
			E('option', { 'value': 'ipv6' }, [ 'IPv6' ])
		]);
		this.el.overviewGrid = E('div', { 'class': 'overview-grid', 'id': 'bplus-overview-grid' });

		this.el.devicesIfaceSelect = E('select', { 'class': 'cbi-input-select' }, [ E('option', { 'value': '' }, [ _('All interfaces') ]) ]);
		this.el.deviceModeSelect = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'simple' }, [ _('Simple Mode') ]),
			E('option', { 'value': 'detailed' }, [ _('Detailed Mode') ])
		]);
		this.el.deviceModeSelect.value = this.deviceDisplayMode;
		this.el.devicesCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-devices-count' }, [ _('Online devices') + ': 0 / 0' ]);

		this.el.trendCount = E('span', { 'class': 'meta-pill', 'id': 'bplus-trend-count' }, [ formatEntriesPillText(0) ]);

		this.el.trendCanvas = E('canvas', { 'class': 'bplus-chart-canvas' });
		this.el.trendTooltip = E('div', { 'class': 'bplus-tooltip history-tooltip' });
		this.el.deviceHead = E('thead');
		this.el.deviceBody = E('tbody');

		this.el.rankIface = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-rank-iface' });
		this.el.rankTrafficTypeSelect = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-rank-tt' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'ipv4' }, [ 'IPv4' ]),
			E('option', { 'value': 'ipv6' }, [ 'IPv6' ])
		]);
		this.el.rankStart = E('input', { 'class': 'cbi-input-text cbi-input-date', 'type': 'date', 'id': 'bplus-rank-start' });
		this.el.rankEnd = E('input', { 'class': 'cbi-input-text cbi-input-date', 'type': 'date', 'id': 'bplus-rank-end' });
		this.el.rankQuery = E('button', { 'class': 'cbi-button cbi-button-action usage-ranking-query-btn', 'type': 'button', 'id': 'bplus-rank-query' }, [ E('span', {}, [ _('Query') ]) ]);
		this.el.rankReset = E('button', { 'class': 'cbi-button cbi-button-reset', 'type': 'button', 'id': 'bplus-rank-reset' }, [ _('Reset') ]);
		this.el.rankPresetToday = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'today' }, [ _('Today') ]);
		this.el.rankPresetThisWeek = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'thisweek' }, [ _('This Week') ]);
		this.el.rankPresetLastWeek = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'lastweek' }, [ _('Last Week') ]);
		this.el.rankPresetThisMonth = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'thismonth' }, [ _('This Month') ]);
		this.el.rankPresetLastMonth = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'lastmonth' }, [ _('Last Month') ]);
		this.el.rankPreset7Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '7days' }, [ _('Last 7 Days') ]);
		this.el.rankPreset30Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '30days' }, [ _('Last 30 Days') ]);
		this.el.rankPreset90Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '90days' }, [ _('Last 90 Days') ]);
		this.el.rankPreset1Year = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '1year' }, [ _('Last Year') ]);
		this.el.rankTimeline = E('div', { 'class': 'usage-ranking-timeline', 'id': 'bplus-rank-timeline' }, [
			this.el.rankTimelineRange = E('div', { 'class': 'usage-ranking-timeline-range', 'id': 'bplus-rank-timeline-range' })
		]);
		this.el.rankWrap = E('div', { 'id': 'bplus-usage-ranking-container' }, [
			E('div', { 'class': 'loading-state' }, [ _('Loading...') ])
		]);

		this.el.ifaceLimitBody = E('tbody');
		this.el.guestRuleBody = E('tbody');

		this.el.ifLimitIfaceList = E('datalist', { 'id': 'bplus_iflimit_iface_list' });

		this.el.schStart = E('input', { 'class': 'cbi-input-text bplus-schedule-time-input', 'type': 'time', 'value': '09:00' });
		this.el.schEnd = E('input', { 'class': 'cbi-input-text bplus-schedule-time-input', 'type': 'time', 'value': '18:00' });
		this.el.schD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.schD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.schU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.schU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.schD4Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.schD6Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.schU4Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.schU6Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.schSave = E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Add') ]);
		this.el.schCancel = E('button', { 'class': 'btn cbi-button cbi-button-reset', 'type': 'button' }, [ _('Cancel') ]);
		this.el.scheduleRuleDismiss = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-reset bplus-modal-dismiss', 'aria-label': 'Close' }, [ '×' ]);

		this.el.scheduleDayWrap = E('div', { 'class': 'bplus-schedule-days' });
		var dayLabels = [ _('Mon'), _('Tue'), _('Wed'), _('Thu'), _('Fri'), _('Sat'), _('Sun') ];
		for (var dnx = 1; dnx <= 7; dnx++) {
			var dayBtn = E('button', {
				'type': 'button',
				'class': 'bplus-schedule-day-btn' + (dnx <= 5 ? ' active' : ''),
				'data-day': String(dnx)
			}, [ dayLabels[dnx - 1] ]);
			this.el.scheduleDayWrap.appendChild(dayBtn);
		}
		this.el.scheduleDayWrap.addEventListener('click', L.bind(function (ev) {
			var t = ev.target;
			if (t && t.classList && t.classList.contains('bplus-schedule-day-btn'))
				t.classList.toggle('active');
		}, this));

		this.el.scheduleForm = E('form', { 'class': 'bplus-schedule-form' }, [
			E('div', { 'class': 'bplus-form-group' }, [
				E('div', { 'class': 'bplus-schedule-time-row' }, [
					this.el.schStart,
					E('span', { 'class': 'bplus-schedule-time-sep' }, [ ' — ' ]),
					this.el.schEnd
				])
			]),
			E('div', { 'class': 'bplus-form-group' }, [
				this.el.scheduleDayWrap
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Download') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.schD4, this.el.schD4Unit ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.schD6, this.el.schD6Unit ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Upload') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.schU4, this.el.schU4Unit ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.schU6, this.el.schU6Unit ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-modal-form-footer' }, [ this.el.schCancel, this.el.schSave ])
		]);

		this.scheduleDayButtonList = Array.prototype.slice.call(this.el.scheduleDayWrap.querySelectorAll('.bplus-schedule-day-btn'));

		this.el.scheduleRuleTitle = E('h3', { 'class': 'bplus-modal-title' }, [ _('Add schedule rule') ]);
		this.el.scheduleRulePanel = E('div', { 'class': 'bplus-modal-panel bplus-modal-panel--rule' }, [
			E('div', { 'class': 'bplus-modal-header' }, [
				this.el.scheduleRuleTitle,
				this.el.scheduleRuleDismiss
			]),
			E('div', { 'class': 'bplus-modal-body' }, [ this.el.scheduleForm ])
		]);
		this.el.scheduleRuleOverlay = E('div', {
			'class': 'bplus-modal-overlay bplus-modal-overlay--stack',
			'id': 'bplus-schedule-rule-modal'
		}, [ this.el.scheduleRulePanel ]);

		this.el.scheduleHubPrimary = E('div', { 'class': 'bplus-schedule-hub-primary' });
		this.el.scheduleHubMeta = E('div', { 'class': 'bplus-schedule-hub-meta' });
		this.el.scheduleHubHostnameInput = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'placeholder': _('Device hostname') });
		this.el.scheduleHubHostnameSave = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-save',
			'click': L.bind(this.submitScheduleHubHostname, this)
		}, [ _('Save') ]);
		this.el.scheduleHubAddRuleBtn = E('button', {
			'type': 'button',
			'class': 'btn cbi-button cbi-button-action',
			'click': L.bind(this.openScheduleRuleModalAdd, this)
		}, [ _('Add rule') ]);
		this.el.scheduleHubRulesList = E('div', { 'class': 'bplus-schedule-rules-list' });
		this.el.scheduleHubCloseBtn = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-reset' }, [ _('Close') ]);
		this.el.scheduleHubTitle = E('h3', { 'class': 'bplus-modal-title' }, [ _('Schedule rules') ]);
		this.el.scheduleHubPanel = E('div', { 'class': 'bplus-modal-panel bplus-modal-panel--hub' }, [
			E('div', { 'class': 'bplus-modal-header' }, [ this.el.scheduleHubTitle ]),
			E('div', { 'class': 'bplus-modal-body' }, [
				E('div', { 'class': 'bplus-schedule-hub-summary' }, [ this.el.scheduleHubPrimary, this.el.scheduleHubMeta ]),
				E('div', { 'class': 'bplus-form-group bplus-schedule-hostname-block' }, [
					E('label', { 'class': 'bplus-form-label' }, [ _('Hostname') ]),
					E('div', { 'class': 'bplus-schedule-hostname-actions' }, [
						this.el.scheduleHubHostnameInput,
						this.el.scheduleHubHostnameSave
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Set hostname for this device.') ])
			]),
			E('div', { 'class': 'bplus-schedule-hub-toolbar' }, [
				E('span', { 'class': 'bplus-subline' }, [ _('Scheduled rate limits') ]),
				this.el.scheduleHubAddRuleBtn
			]),
				this.el.scheduleHubRulesList,
				E('div', { 'class': 'bplus-modal-form-footer' }, [ this.el.scheduleHubCloseBtn ])
			])
		]);
		this.el.scheduleHubOverlay = E('div', {
			'class': 'bplus-modal-overlay',
			'id': 'bplus-schedule-hub-modal'
		}, [ this.el.scheduleHubPanel ]);

		this.el.scheduleDeleteConfirmCancel = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-reset'
		}, [ _('Cancel') ]);
		this.el.scheduleDeleteConfirmOk = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-negative'
		}, [ _('Delete') ]);
		this.el.scheduleDeleteConfirmOverlay = E('div', {
			'class': 'bandix-modal-overlay',
			'id': 'bplus-schedule-delete-confirm',
			'aria-modal': 'true'
		}, [
			E('div', { 'class': 'modal-content bandix-modal confirm-dialog' }, [
				E('div', { 'class': 'bandix-modal-body' }, [
					E('div', { 'class': 'confirm-dialog-title' }, [ _('Delete schedule rule') ]),
					E('div', { 'class': 'confirm-dialog-message' }, [ _('Are you sure you want to delete this schedule rule?') ]),
					E('div', { 'class': 'confirm-dialog-footer' }, [
						this.el.scheduleDeleteConfirmCancel,
						this.el.scheduleDeleteConfirmOk
					])
				])
			])
		]);

		this.el.ifaceLimitModalTitle = E('h3', { 'class': 'bplus-modal-title' }, [ _('Set iface limit') ]);
		this.el.ifaceLimitModalDismiss = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-reset bplus-modal-dismiss', 'aria-label': 'Close' }, [ '×' ]);
		this.el.ifaceLimitIfaceReadonly = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'readonly': 'readonly' });
		this.el.ifaceLimitD4Modal = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.ifaceLimitD6Modal = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.ifaceLimitU4Modal = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.ifaceLimitU6Modal = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.ifaceLimitD4UnitModal = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.ifaceLimitD6UnitModal = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.ifaceLimitU4UnitModal = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.ifaceLimitU6UnitModal = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.ifaceLimitModalSave = E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Save') ]);
		this.el.ifaceLimitModalCancel = E('button', { 'class': 'btn cbi-button cbi-button-reset', 'type': 'button' }, [ _('Cancel') ]);
		this.el.ifaceLimitModalForm = E('form', { 'class': 'bplus-schedule-form bplus-iface-limit-form' }, [
			E('div', { 'class': 'bplus-form-group' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Iface') ]),
				this.el.ifaceLimitIfaceReadonly
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Download') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.ifaceLimitD4Modal, this.el.ifaceLimitD4UnitModal ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.ifaceLimitD6Modal, this.el.ifaceLimitD6UnitModal ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Upload') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.ifaceLimitU4Modal, this.el.ifaceLimitU4UnitModal ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.ifaceLimitU6Modal, this.el.ifaceLimitU6UnitModal ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-modal-form-footer' }, [ this.el.ifaceLimitModalCancel, this.el.ifaceLimitModalSave ])
		]);
		this.el.ifaceLimitPanel = E('div', { 'class': 'bplus-modal-panel bplus-modal-panel--iface-limit' }, [
			E('div', { 'class': 'bplus-modal-header' }, [
				this.el.ifaceLimitModalTitle,
				this.el.ifaceLimitModalDismiss
			]),
			E('div', { 'class': 'bplus-modal-body' }, [ this.el.ifaceLimitModalForm ])
		]);
		this.el.ifaceLimitOverlay = E('div', {
			'class': 'bplus-modal-overlay',
			'id': 'bplus-iface-limit-modal'
		}, [ this.el.ifaceLimitPanel ]);

		this.el.ifLimitIface = E('input', { 'class': 'cbi-input-text', 'list': 'bplus_iflimit_iface_list', 'placeholder': 'eth0' });
		this.el.ifLimitD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'step': '0.01', 'value': '0' });
		this.el.ifLimitD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'step': '0.01', 'value': '0' });
		this.el.ifLimitU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'step': '0.01', 'value': '0' });
		this.el.ifLimitU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'step': '0.01', 'value': '0' });
		this.el.ifaceLimitForm = E('form', { 'class': 'form-grid' }, [
			E('label', { 'class': 'field' }, [ _('Iface'), this.el.ifLimitIface ]),
			E('label', { 'class': 'field' }, [ 'down v4 (MB/s)', this.el.ifLimitD4 ]),
			E('label', { 'class': 'field' }, [ 'down v6 (MB/s)', this.el.ifLimitD6 ]),
			E('label', { 'class': 'field' }, [ 'up v4 (MB/s)', this.el.ifLimitU4 ]),
			E('label', { 'class': 'field' }, [ 'up v6 (MB/s)', this.el.ifLimitU6 ]),
			E('div', { 'class': 'actions-row field-wide' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Save') ])
			])
		]);

		this.el.guestRuleIface = E('select', { 'class': 'cbi-input-select' });
		this.el.guestRuleD4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.guestRuleD6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.guestRuleU4 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.guestRuleU6 = E('input', { 'class': 'cbi-input-text', 'type': 'number', 'min': '0', 'step': '0.01', 'value': '0' });
		this.el.guestRuleD4Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.guestRuleD6Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.guestRuleU4Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.guestRuleU6Unit = E('select', { 'class': 'cbi-input-select bplus-rate-unit-select', 'aria-label': _('Rate unit') });
		this.el.guestRuleEnabled = E('input', { 'type': 'checkbox' });
		this.el.guestRuleWhitelistInput = E('select', { 'class': 'cbi-input-select' });
		this.el.guestRuleWhitelistAdd = E('button', { 'class': 'btn cbi-button cbi-button-action', 'type': 'button' }, [ _('Add') ]);
		this.el.guestRuleWhitelistBody = E('tbody');
		this.el.guestRuleModalDismiss = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-reset bplus-modal-dismiss', 'aria-label': 'Close' }, [ '×' ]);
		this.el.guestRuleModalCancel = E('button', { 'class': 'btn cbi-button cbi-button-reset', 'type': 'button' }, [ _('Cancel') ]);
		this.el.guestRuleModalSave = E('button', { 'class': 'btn cbi-button cbi-button-save', 'type': 'submit' }, [ _('Save') ]);
		this.el.guestRuleForm = E('form', { 'class': 'bplus-schedule-form bplus-guest-rule-form' }, [
			E('div', { 'class': 'bplus-form-group' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Iface') ]),
				this.el.guestRuleIface
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Upload') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.guestRuleU4, this.el.guestRuleU4Unit ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.guestRuleU6, this.el.guestRuleU6Unit ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-form-group bplus-schedule-limits-block' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Download') ]),
				E('div', { 'class': 'bplus-schedule-rate-pair' }, [
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv4' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.guestRuleD4, this.el.guestRuleD4Unit ])
					]),
					E('div', { 'class': 'bplus-schedule-rate-col' }, [
						E('span', { 'class': 'bplus-form-sublabel' }, [ 'IPv6' ]),
						E('div', { 'class': 'bplus-rate-input-row' }, [ this.el.guestRuleD6, this.el.guestRuleD6Unit ])
					])
				]),
				E('div', { 'class': 'bplus-form-hint' }, [ _('Tip: 0 means unlimited') ])
			]),
			E('div', { 'class': 'bplus-form-group bplus-guest-enabled-row' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Enabled') ]),
				E('label', { 'class': 'bplus-toggle' }, [
					this.el.guestRuleEnabled
				])
			]),
			E('div', { 'class': 'bplus-form-group' }, [
				E('label', { 'class': 'bplus-form-label' }, [ _('Whitelist') ]),
				E('div', { 'class': 'bplus-guest-whitelist-add-row' }, [
					this.el.guestRuleWhitelistInput,
					this.el.guestRuleWhitelistAdd
				]),
				E('div', { 'class': 'table-wrapper compact' }, [
					E('table', { 'class': 'table bplus-table bplus-guest-whitelist-table' }, [
						E('thead', {}, [ E('tr', {}, [ E('th', {}, [ _('Hostname') ]), E('th', {}, [ 'MAC' ]), E('th', {}, [ _('actions') ]) ]) ]),
						this.el.guestRuleWhitelistBody
					])
				])
			]),
			E('div', { 'class': 'bplus-modal-form-footer' }, [ this.el.guestRuleModalCancel, this.el.guestRuleModalSave ])
		]);
		this.el.guestRuleModalTitle = E('h3', { 'class': 'bplus-modal-title' }, [ _('Guest rule') ]);
		this.el.guestRuleOverlay = E('div', { 'class': 'bplus-modal-overlay', 'id': 'bplus-guest-rule-modal' }, [
			E('div', { 'class': 'bplus-modal-panel bplus-modal-panel--guest' }, [
				E('div', { 'class': 'bplus-modal-header' }, [
					this.el.guestRuleModalTitle,
					this.el.guestRuleModalDismiss
				]),
				E('div', { 'class': 'bplus-modal-body' }, [ this.el.guestRuleForm ])
			])
		]);

		this.el.guestPolicyAddRuleBtn = E('button', { 'type': 'button', 'class': 'btn cbi-button cbi-button-action' }, [ _('Add rule') ]);
		this.el.guestRulesPane = E('div', { 'class': 'guest-policy-pane guest-policy-pane--rules' }, [
			E('div', { 'class': 'table-wrapper compact' }, [
				E('table', { 'class': 'table bplus-table bplus-guest-rules-table' }, [
					E('thead', {}, [ E('tr', {}, [
						E('th', {}, [ _('Iface') ]),
						E('th', {}, [ _('IPv4 Upload') ]),
						E('th', {}, [ _('IPv4 Download') ]),
						E('th', {}, [ _('IPv6 Upload') ]),
						E('th', {}, [ _('IPv6 Download') ]),
						E('th', {}, [ _('Whitelist') ]),
						E('th', {}, [ _('Enabled') ]),
						E('th', {}, [ _('Actions') ])
					]) ]),
					this.el.guestRuleBody
				])
			])
		]);

		this.el.statsIface = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-stats-iface' });
		this.el.statsStart = E('input', { 'class': 'cbi-input-text cbi-input-date', 'type': 'date', 'id': 'bplus-stats-start' });
		this.el.statsEnd = E('input', { 'class': 'cbi-input-text cbi-input-date', 'type': 'date', 'id': 'bplus-stats-end' });
		this.el.statsBucket = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-stats-bucket' }, [
			E('option', { 'value': 'hourly' }, [ _('Hourly') ]),
			E('option', { 'value': 'daily' }, [ _('Daily') ])
		]);
		this.el.statsBucket.value = 'hourly';
		this.el.statsQuery = E('button', { 'class': 'cbi-button cbi-button-action usage-ranking-query-btn', 'type': 'button', 'id': 'bplus-stats-query' }, [ E('span', {}, [ _('Query') ]) ]);
		this.el.statsReset = E('button', { 'class': 'cbi-button cbi-button-reset', 'type': 'button', 'id': 'bplus-stats-reset' }, [ _('Reset') ]);
		this.el.presetToday = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'today' }, [ _('Today') ]);
		this.el.presetThisWeek = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'thisweek' }, [ _('This Week') ]);
		this.el.presetLastWeek = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'lastweek' }, [ _('Last Week') ]);
		this.el.presetThisMonth = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'thismonth' }, [ _('This Month') ]);
		this.el.presetLastMonth = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': 'lastmonth' }, [ _('Last Month') ]);
		this.el.preset7Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '7days' }, [ _('Last 7 Days') ]);
		this.el.preset30Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '30days' }, [ _('Last 30 Days') ]);
		this.el.preset90Days = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '90days' }, [ _('Last 90 Days') ]);
		this.el.preset1Year = E('button', { 'class': 'cbi-button cbi-button-neutral', 'type': 'button', 'data-preset': '1year' }, [ _('Last Year') ]);
		this.el.statsTimeline = E('div', { 'class': 'usage-ranking-timeline', 'id': 'bplus-hstats-timeline' }, [
			this.el.statsTimelineRange = E('div', { 'class': 'usage-ranking-timeline-range', 'id': 'bplus-hstats-timeline-range' })
		]);
		this.el.rankTimerange = E('span', { 'class': 'usage-ranking-timerange', 'id': 'bplus-usage-ranking-timerange' }, []);
		this.el.statsHistogramTimerange = E('span', { 'class': 'usage-ranking-timerange', 'id': 'bplus-hstats-timerange' }, []);
		this.el.statsCanvas = E('canvas', { 'class': 'bplus-chart-canvas bplus-stats-chart' });
		this.el.statsTooltip = E('div', { 'class': 'bplus-tooltip traffic-increments-tooltip' });
		this.el.statsLegend = E('div', { 'class': 'traffic-stats-legend' }, [
			E('div', { 'class': 'traffic-stats-legend-item' }, [
				E('span', { 'class': 'traffic-stats-legend-dot tx' }),
				E('span', {}, [ _('Upload') ])
			]),
			E('div', { 'class': 'traffic-stats-legend-item' }, [
				E('span', { 'class': 'traffic-stats-legend-dot rx' }),
				E('span', {}, [ _('Download') ])
			])
		]);
		this.el.statsSummaryUpVal = E('div', { 'class': 'traffic-increments-summary-value' }, [ '—' ]);
		this.el.statsSummaryDownVal = E('div', { 'class': 'traffic-increments-summary-value' }, [ '—' ]);
		this.el.statsSummaryTotalVal = E('div', { 'class': 'traffic-increments-summary-value' }, [ '—' ]);
		this.el.statsSummary = E('div', { 'class': 'traffic-increments-summary' }, [
			E('div', { 'class': 'traffic-increments-summary-item' }, [
				E('div', { 'class': 'traffic-increments-summary-label' }, [ _('Total Upload Usage') ]),
				this.el.statsSummaryUpVal
			]),
			E('div', { 'class': 'traffic-increments-summary-item' }, [
				E('div', { 'class': 'traffic-increments-summary-label' }, [ _('Total Download Usage') ]),
				this.el.statsSummaryDownVal
			]),
			E('div', { 'class': 'traffic-increments-summary-item' }, [
				E('div', { 'class': 'traffic-increments-summary-label' }, [ _('Total Usage') ]),
				this.el.statsSummaryTotalVal
			])
		]);
		this.el.statsMacSelect = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-stats-mac' }, [ E('option', { 'value': '' }, [ _('All devices') ]) ]);
		this.el.statsTrafficTypeSelect = E('select', { 'class': 'cbi-input-select', 'id': 'bplus-stats-tt' }, [
			E('option', { 'value': 'all' }, [ _('All') ]),
			E('option', { 'value': 'ipv4' }, [ 'IPv4' ]),
			E('option', { 'value': 'ipv6' }, [ 'IPv6' ])
		]);

		var nowWall = new Date();
		var todayCal = new Date(nowWall.getFullYear(), nowWall.getMonth(), nowWall.getDate());
		var from30 = new Date(todayCal.getTime() - 29 * 86400000);
		this.el.rankStart.value = formatDateInput(from30);
		this.el.rankEnd.value = formatDateInput(todayCal);
		this.el.statsStart.value = formatDateInput(from30);
		this.el.statsEnd.value = formatDateInput(todayCal);
		this.el.trendTypeSelect.value = this.selectedTrendType;
		this.el.statsLoadingNotice = E('div', { 'class': 'bplus-stats-loading-notice', 'style': 'display:none' }, []);

		this.root = E('div', { 'class': 'bplus-page' }, [
			E('div', { 'class': 'bplus-main' }, [
				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', [ _('Interface Overview') ]),
						E('div', { 'class': 'bplus-overview-head-tools' }, [
							this.el.rateUnitToggle
						])
					]),
					this.el.overviewGrid
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-trend-title-row' }, [
						E('div', { 'class': 'bplus-panel-head', 'style': 'margin:0;flex:1;min-width:0' }, [
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
						E('label', {}, [ _('Traffic Type'), this.el.trendTypeSelect ])
					]),
					E('div', { 'class': 'bplus-chart-wrap' }, [ this.el.trendCanvas, this.el.trendTooltip ]),
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', {}, [ _('Device List') ]),
						this.el.devicesCount
					]),
					E('div', { 'class': 'bplus-inline-form' }, [
						E('label', {}, [ _('Iface'), this.el.devicesIfaceSelect ]),
						E('label', {}, [ _('Period'), this.el.periodSelect ]),
						E('label', {}, [ _('Display mode'), this.el.deviceModeSelect ])
					]),
					E('div', { 'class': 'table-wrapper' }, [ E('table', { 'class': 'table bplus-table bplus-table--devices' }, [ this.el.deviceHead, this.el.deviceBody ]) ])
				]),

				E('section', { 'class': 'bplus-panel bplus-usage-ranking-section' }, [
					E('div', { 'class': 'usage-ranking-header' }, [
						E('div', { 'class': 'bplus-panel-head', 'style': 'margin:0;flex:1;min-width:0' }, [
							E('h2', {}, [ _('Device Usage Ranking') ])
						]),
						this.el.rankTimerange
					]),
					E('div', { 'class': 'traffic-increments-query' }, [
						E('div', { 'class': 'usage-ranking-date-range-row' }, [
							E('div', { 'class': 'usage-ranking-network-type-wrapper' }, [
								E('label', { 'class': 'usage-ranking-network-label', 'for': 'bplus-rank-iface' }, [ _('Iface') ]),
								this.el.rankIface
							]),
							E('div', { 'class': 'usage-ranking-network-type-wrapper' }, [
								E('label', { 'class': 'usage-ranking-network-label', 'for': 'bplus-rank-tt' }, [ _('Traffic Type') ]),
								this.el.rankTrafficTypeSelect
							]),
							E('div', { 'class': 'usage-ranking-date-picker-wrapper' }, [
								E('label', { 'class': 'usage-ranking-date-label', 'for': 'bplus-rank-start' }, [ _('Start Date') ]),
								E('div', { 'class': 'usage-ranking-date-picker' }, [ this.el.rankStart ])
							]),
							E('span', { 'class': 'usage-ranking-date-separator' }, '→'),
							E('div', { 'class': 'usage-ranking-date-picker-wrapper' }, [
								E('label', { 'class': 'usage-ranking-date-label', 'for': 'bplus-rank-end' }, [ _('End Date') ]),
								E('div', { 'class': 'usage-ranking-date-picker' }, [ this.el.rankEnd ])
							]),
							E('div', { 'class': 'usage-ranking-query-actions' }, [
								this.el.rankQuery,
								this.el.rankReset
							])
						]),
						E('div', { 'class': 'usage-ranking-query-presets' }, [
							this.el.rankPresetToday,
							this.el.rankPresetThisWeek,
							this.el.rankPresetLastWeek,
							this.el.rankPresetThisMonth,
							this.el.rankPresetLastMonth,
							this.el.rankPreset7Days,
							this.el.rankPreset30Days,
							this.el.rankPreset90Days,
							this.el.rankPreset1Year
						]),
						this.el.rankTimeline
					]),
					this.el.rankWrap
				]),

				E('section', { 'class': 'bplus-panel bplus-histogram-section' }, [
					E('div', { 'class': 'usage-ranking-header' }, [
						E('div', { 'class': 'bplus-panel-head', 'style': 'margin:0;flex:1;min-width:0' }, [
							E('h2', {}, [ _('Traffic Timeline') ])
						]),
						this.el.statsHistogramTimerange
					]),
					E('div', { 'class': 'traffic-increments-query' }, [
						E('div', { 'class': 'usage-ranking-date-range-row' }, [
							E('div', { 'class': 'usage-ranking-network-type-wrapper' }, [
								E('label', { 'class': 'usage-ranking-network-label', 'for': 'bplus-stats-iface' }, [ _('Iface') ]),
								this.el.statsIface
							]),
							E('div', { 'class': 'usage-ranking-network-type-wrapper' }, [
								E('label', { 'class': 'usage-ranking-network-label', 'for': 'bplus-stats-tt' }, [ _('Traffic Type') ]),
								this.el.statsTrafficTypeSelect
							]),
							E('div', { 'class': 'usage-ranking-date-picker-wrapper' }, [
								E('label', { 'class': 'usage-ranking-date-label', 'for': 'bplus-stats-start' }, [ _('Start Date') ]),
								E('div', { 'class': 'usage-ranking-date-picker' }, [ this.el.statsStart ])
							]),
							E('span', { 'class': 'usage-ranking-date-separator' }, '→'),
							E('div', { 'class': 'usage-ranking-date-picker-wrapper' }, [
								E('label', { 'class': 'usage-ranking-date-label', 'for': 'bplus-stats-end' }, [ _('End Date') ]),
								E('div', { 'class': 'usage-ranking-date-picker' }, [ this.el.statsEnd ])
							]),
							E('div', { 'class': 'usage-ranking-query-actions' }, [
								this.el.statsQuery,
								this.el.statsReset
							])
						]),
						E('div', { 'class': 'usage-ranking-query-presets' }, [
							this.el.presetToday,
							this.el.presetThisWeek,
							this.el.presetLastWeek,
							this.el.presetThisMonth,
							this.el.presetLastMonth,
							this.el.preset7Days,
							this.el.preset30Days,
							this.el.preset90Days,
							this.el.preset1Year
						]),
						this.el.statsTimeline
					]),
					E('div', { 'class': 'traffic-increments-filters' }, [
						E('div', { 'class': 'traffic-increments-filter-group' }, [
							E('label', { 'class': 'traffic-increments-filter-label', 'for': 'bplus-stats-bucket' }, [ _('Aggregation:') ]),
							this.el.statsBucket
						]),
						E('div', { 'class': 'traffic-increments-filter-group' }, [
							E('label', { 'class': 'traffic-increments-filter-label', 'for': 'bplus-stats-mac' }, [ _('Device:') ]),
							this.el.statsMacSelect
						])
					]),
					this.el.statsLoadingNotice,
					E('div', { 'class': 'bplus-chart-wrap' }, [ this.el.statsCanvas, this.el.statsTooltip ]),
					this.el.statsLegend,
					this.el.statsSummary
				]),

				E('section', { 'class': 'bplus-panel' }, [
					E('div', { 'class': 'bplus-panel-head' }, [
						E('h2', {}, [ _('Guest control') ])
					]),
					E('div', { 'class': 'policy-grid' }, [
						E('article', { 'class': 'policy-card' }, [
							E('div', { 'class': 'guest-policy-toolbar' }, [
								E('span', { 'class': 'bplus-subline' }, [ _('Guest rules') ]),
								E('div', { 'class': 'guest-policy-actions' }, [ this.el.guestPolicyAddRuleBtn ])
							]),
							this.el.guestRulesPane
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
		this.setRateUnitMode(this.rateUnitMode, false);
		if (this.el.scheduleHubOverlay && this.el.scheduleHubOverlay.parentNode !== this.root)
			this.root.appendChild(this.el.scheduleHubOverlay);
		if (this.el.scheduleRuleOverlay && this.el.scheduleRuleOverlay.parentNode !== this.root)
			this.root.appendChild(this.el.scheduleRuleOverlay);
		if (this.el.scheduleDeleteConfirmOverlay && this.el.scheduleDeleteConfirmOverlay.parentNode !== this.root)
			this.root.appendChild(this.el.scheduleDeleteConfirmOverlay);
		if (this.el.ifaceLimitOverlay && this.el.ifaceLimitOverlay.parentNode !== this.root)
			this.root.appendChild(this.el.ifaceLimitOverlay);
		if (this.el.guestRuleOverlay && this.el.guestRuleOverlay.parentNode !== this.root)
			this.root.appendChild(this.el.guestRuleOverlay);
		this.setThemeClass();
		this.bindEvents();

		var cap = formatDateInput(new Date());
		this.el.rankStart.setAttribute('max', cap);
		this.el.rankEnd.setAttribute('max', cap);
		this.el.statsStart.setAttribute('max', cap);
		this.el.statsEnd.setAttribute('max', cap);

		this.refreshLive(false).then(L.bind(function () {
			if (this.el.statsIface && this.el.statsIface.value) this.queryStats();
			if (this.el.rankIface && this.el.rankIface.value) this.queryUsageRanking();
		}, this));
		this.refreshRateData(false);
		this.applyRankPreset('1year');
		this.applyStatsPreset('1year');

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
