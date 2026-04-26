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

		m = new form.Map('bandix_plus', _('Bandix Plus'), _('HTTP API 端口与 bandix-plus --api-bind 的端口段一致，默认 9911。'));
		m.versionInfo = vinfo;

		s = m.section(form.NamedSection, 'general', 'bandix_plus', _('General'));
		s.addremove = false;
		s.description = _('This LuCI only proxies JSON to 127.0.0.1:<port> (see also bandix_plus/src/api.rs).');

		o = s.option(form.Value, 'port', _('Port'), _('Listener port of bandix-plus JSON API (integer only).'));
		o.datatype = 'port';
		o.placeholder = '9911';
		o.default = '9911';
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
