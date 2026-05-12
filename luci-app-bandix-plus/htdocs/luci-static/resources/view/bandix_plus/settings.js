'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require tools.widgets as widgets';
var callGetVersion = rpc.declare({ object: 'luci.bandix_plus', method: 'getVersion', expect: {} });
var callRestart = rpc.declare({ object: 'luci.bandix_plus', method: 'restartService', expect: {} });

function bplusJson(r) {
	if (r == null) return null;
	if (typeof r === 'string') return JSON.parse(r);
	return r;
}

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('bandix_plus'),
			uci.load('network'),
			callGetVersion().then(bplusJson)
		]);
	},

	render: function (load) {
		var m, s, o;
		var vinfo = load[ 2 ] || {};

		if (!uci.get('bandix_plus', 'general')) {
			uci.add('bandix_plus', 'bandix_plus', 'general');
		}

		m = new form.Map('bandix_plus', _('Bandix Plus'), _('Runtime options for openwrt-bandix-plus service.'));
		m.versionInfo = vinfo;

		s = m.section(form.NamedSection, 'general', 'bandix_plus', _('General'));
		s.addremove = false;
		s.description = _('This page edits /etc/config/bandix-plus general options.');

		o = s.option(form.Flag, 'enable_traffic', _('Enable traffic collection'), _('When disabled, bandix-plus service will not start.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(widgets.DeviceSelect, 'iface', _('Interfaces'), _('Select one or more interfaces to monitor.'));
		o.multiple = true;
		o.noaliases = true;
		o.nobridges = false;
		o.nocreate = true;
		o.rmempty = false;

		o = s.option(form.ListValue, 'log_level', _('Log level'));
		o.value('trace', 'trace');
		o.value('debug', 'debug');
		o.value('info', 'info');
		o.value('warn', 'warn');
		o.value('error', 'error');
		o.default = 'info';
		o.rmempty = false;

		o = s.option(form.ListValue, 'tc_backend', _('TC backend'), _('Select TC attach backend. Recommendation: use auto by default; tcx is preferred on kernel >= 6.6; netlink is safer on older kernels.'));
		o.value('auto', 'auto');
		o.value('tcx', 'tcx');
		o.value('netlink', 'netlink');
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.ListValue, 'tc_order', _('TC order'));
		o.value('first', 'first');
		o.value('default', 'default');
		o.value('last', 'last');
		o.value('before', 'before');
		o.value('after', 'after');
		o.default = 'default';
		o.rmempty = false;
		o.depends('tc_backend', 'tcx');

		o = s.option(form.Value, 'netlink_priority', _('Netlink priority'), _('Only used when backend is netlink. Range: 0..65535 (0 means default).'));
		o.datatype = 'range(0,65535)';
		o.default = '0';
		o.placeholder = '0';
		o.rmempty = false;
		o.depends('tc_backend', 'netlink');

		o = s.option(form.Value, 'tcx_anchor_ingress_id', _('TCX ingress anchor program id'), _('Used when tc_order is before/after. Must be a valid ingress program id on the same interface.'));
		o.datatype = 'uinteger';
		o.rmempty = true;
		o.depends({ tc_backend: 'tcx', tc_order: 'before' });
		o.depends({ tc_backend: 'tcx', tc_order: 'after' });

		o = s.option(form.Value, 'tcx_anchor_egress_id', _('TCX egress anchor program id'), _('Used when tc_order is before/after. Must be a valid egress program id on the same interface.'));
		o.datatype = 'uinteger';
		o.rmempty = true;
		o.depends({ tc_backend: 'tcx', tc_order: 'before' });
		o.depends({ tc_backend: 'tcx', tc_order: 'after' });

		o = s.option(form.Flag, 'traffic_enable_storage', _('Enable traffic persistence storage'), _('Persist traffic histogram/ring data to disk. Disabled by default.'));
		o.default = '0';
		o.rmempty = false;

		// o = s.option(form.Value, 'history_window_minutes', _('History window (minutes)'));
		// o.datatype = 'uinteger';
		// o.placeholder = '10';
		// o.default = '10';
		// o.rmempty = false;

		o = s.option(form.Value, 'host', _('Host'));
		o.placeholder = '127.0.0.1';
		o.default = '127.0.0.1';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('Port'));
		o.datatype = 'port';
		o.placeholder = '8787';
		o.default = '8787';
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
				if (!r || r.ok !== '1') {
					ui.addNotification(null, E('pre', {}, [ JSON.stringify(r) ]), 'error');
				}
			});
		};

		return m.render();
	}
});
