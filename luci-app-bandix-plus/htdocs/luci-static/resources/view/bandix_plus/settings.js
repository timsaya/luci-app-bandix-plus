'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require tools.widgets as widgets';

var callRestartService = rpc.declare({ object: 'luci.bandix_plus', method: 'restartService', expect: {} });

return view.extend({
	load: function () {
		return Promise.all([
			uci.load('bandix_plus'),
			uci.load('network')
		]);
	},

	render: function () {
		var m, s, o;

		if (!uci.get('bandix_plus', 'general')) {
			uci.add('bandix_plus', 'bandix_plus', 'general');
		}

		m = new form.Map('bandix_plus', _('Bandix Plus'), _('Runtime options for openwrt-bandix-plus service.'));

		s = m.section(form.NamedSection, 'general', 'bandix_plus', _('General'));
		s.addremove = false;
		s.description = _('This page edits /etc/config/bandix_plus general options.');

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

		return m.render();
	},

	handleSaveApply: function (ev, mode) {
		return this.super('handleSaveApply', [ev, mode]).then(function () {
			return callRestartService().catch(function(e) { console.error('Restart failed', e); });
		});
	}
});
