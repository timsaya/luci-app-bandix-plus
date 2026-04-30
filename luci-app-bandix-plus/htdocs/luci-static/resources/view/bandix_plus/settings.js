'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
var callGetVersion = rpc.declare({ object: 'luci.bandix_plus', method: 'getVersion', expect: {} });
var callRestart = rpc.declare({ object: 'luci.bandix_plus', method: 'restartService', expect: {} });

function bplusJson(r) {
	if (r == null) return null;
	if (typeof r === 'string') return JSON.parse(r);
	return r;
}

return view.extend({
	load: function () {
		return Promise.all([ uci.load('bandix_plus'), callGetVersion().then(bplusJson) ]);
	},
	handleSaveApply: null, handleSave: function () { return uci.save(); },
	handleReset: null,

	addFooter: function () { return null; },

	render: function (load) {
		var m, s, o;
		var vinfo = load[ 1 ] || {};

		if (!uci.get('bandix_plus', 'general')) {
			uci.add('bandix_plus', 'bandix_plus', 'general');
		}

		m = new form.Map('bandix_plus', _('Bandix Plus'), _('Runtime options for openwrt-bandix-plus service.'));
		m.versionInfo = vinfo;

		s = m.section(form.NamedSection, 'general', 'bandix_plus', _('General'));
		s.addremove = false;
		s.description = _('This page edits /etc/config/bandix-plus general options. Traffic collection is always enabled by init script.');

		o = s.option(form.Flag, 'enabled', _('Enabled'), _('Start bandix-plus service on boot.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.DynamicList, 'iface', _('Interfaces'), _('Interfaces to monitor, can specify multiple.'));
		o.placeholder = 'br-lan';
		o.rmempty = false;

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		o.value('trace', 'trace');
		o.value('debug', 'debug');
		o.value('info', 'info');
		o.value('warn', 'warn');
		o.value('error', 'error');
		o.default = 'info';
		o.rmempty = false;

		o = s.option(form.ListValue, 'tc_order', _('TC order'));
		o.value('first', 'first');
		o.value('default', 'default');
		o.value('last', 'last');
		o.default = 'first';
		o.rmempty = false;

		o = s.option(form.Value, 'history_window_minutes', _('History window (minutes)'));
		o.datatype = 'uinteger';
		o.placeholder = '10';
		o.default = '10';
		o.rmempty = false;

		o = s.option(form.Value, 'api_bind', _('API bind'), _('Example: 127.0.0.1:8787'));
		o.placeholder = '127.0.0.1:8787';
		o.default = '127.0.0.1:8787';
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('Data directory'));
		o.placeholder = '/usr/share/bandix-plus';
		o.default = '/usr/share/bandix-plus';
		o.rmempty = false;

		o = s.option(form.DummyValue, 'ver', _('Info'));
		o.cfgvalue = function () {
			var z = m.versionInfo;
			if (!z) return '—';
			return 'bandix-plus ipk: ' + (z.bandix_plus_pkg || '') + ' | /api/health: ' + (z.api_health_ok || '0');
		};

		o = s.option(form.Button, 'restart', _('Service'));
		o.inputtitle = _('Restart bandix-plus (init if present)');
		o.inputstyle = 'action';
		o.onclick = function () {
			return callRestart().then(bplusJson).then(function (r) {
				ui.addNotification(null, (r && r.ok === '1') ? _('restarted') : E('pre', {}, [ JSON.stringify(r) ]));
			});
		};

		return m.render();
	}
});
