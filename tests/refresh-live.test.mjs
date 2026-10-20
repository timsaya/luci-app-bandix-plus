import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../luci-app-bandix-plus/htdocs/luci-static/resources/view/bandix_plus/index.js', import.meta.url), 'utf8');
const device = (mac) => ({ logical_iface: 'eth0', mac });
const response = (data = []) => ({ ok: true, data });
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const flush = () => new Promise(resolve => setImmediate(resolve));

function createView(handler) {
    let now = 10000;
    const calls = [];
    const notifications = [];
    const methods = runInNewContext(`(function () { ${source}\n})()`, {
        view: { extend: value => value },
        rpc: { declare: ({ method }) => (...args) => {
            calls.push({ method, args });
            return handler(method, args);
        } },
        L: { bind: (fn, self, ...args) => fn.bind(self, ...args) },
        _: value => value,
        Date: { now: () => now },
        localStorage: { getItem: () => null },
        console: { warn: () => {} }
    });
    const view = Object.assign({}, methods);
    view.initState([]);
    view.el = {};
    view.applyPeriod = value => value;
    for (const name of ['renderIfaceOptions', 'renderOverviewGrid', 'renderDevicesIfaceFilterOptions',
        'renderTrendDeviceOptions', 'renderStatsIfaceOptions', 'renderStatsMacOptions', 'syncRateFormIfaceOptions']) {
        view[name] = () => {};
    }
    const rendered = [];
    view.renderDevicesTable = () => rendered.push(view.devices.map(item => item.mac).join(','));
    view.isScheduleHubUiOpen = () => false;
    view.isDeviceRulePopoverHovered = () => false;
    view.refreshTrend = () => Promise.resolve();
    view.notifyError = (title, error) => notifications.push(error.message);
    return { view, calls, notifications, rendered, advance: ms => { now += ms; } };
}

test('completed device data is saved and rendered despite overlapping refresh and slow overview', async () => {
    const overview = deferred();
    let overviewCalls = 0;
    const { view, calls, rendered, advance } = createView(method => {
        if (method === 'getDevices') return Promise.resolve(response([device('new')]));
        return ++overviewCalls === 1 ? overview.promise : Promise.resolve(response());
    });
    const first = view.refreshLive(false);
    await flush();
    advance(1000);
    await view.refreshLive(false);
    overview.resolve(response());
    await first;
    assert.equal(calls.filter(call => call.method === 'getDevices').length, 1);
    assert.equal(view.devices[0]?.mac, 'new');
    assert.deepEqual(rendered, ['new']);
});

test('automatic failures preserve devices and notify once until a successful fetch', async () => {
    let fail = true;
    const { view, notifications, advance } = createView(method => Promise.resolve(
        method === 'getDevices' ? (fail ? { ok: false, error: 'offline' } : response([device('recovered')])) : response()
    ));
    view.devices = [device('cached')];
    await view.refreshLive(false);
    advance(5001);
    await view.refreshLive(false);
    assert.equal(view.devices[0].mac, 'cached');
    assert.deepEqual(notifications, ['offline']);
    assert.equal(view.devicesLastError, 'offline');
    await view.refreshLive(true);
    assert.deepEqual(notifications, ['offline', 'offline'], 'manual refresh still reports the failure');
    fail = false;
    advance(5001);
    await view.refreshLive(false);
    assert.equal(view.devices[0].mac, 'recovered');
    assert.equal(view.devicesLastError, null);
    fail = true;
    advance(5001);
    await view.refreshLive(false);
    assert.equal(notifications.length, 3, 'failure after recovery is reported again');
});

test('obsolete interface response cannot overwrite the active interface cache', async () => {
    const oldDevices = deferred();
    const { view } = createView((method, args) => {
        if (method !== 'getDevices') return Promise.resolve(response());
        return args[0] === '' ? oldDevices.promise : Promise.resolve(response([device('guest')]));
    });
    const first = view.refreshLive(false);
    view.devicesFilterIface = 'guest0';
    await view.refreshLive(false);
    oldDevices.resolve(response([device('obsolete')]));
    await first;
    assert.equal(view.devices[0].mac, 'guest');
});

test('obsolete interface failure does not notify or replace active error state', async () => {
    const oldDevices = deferred();
    const { view, notifications } = createView((method, args) => {
        if (method !== 'getDevices') return Promise.resolve(response());
        return args[0] === '' ? oldDevices.promise : Promise.resolve(response([device('guest')]));
    });
    const first = view.refreshLive(false);
    view.devicesFilterIface = 'guest0';
    await view.refreshLive(false);
    oldDevices.reject(new Error('obsolete failure'));
    await first;
    assert.deepEqual(notifications, []);
    assert.equal(view.liveRefreshError, null);
    assert.equal(view.devicesLastError, null);
});

test('overlapping requests share device pagination and render the latest result', async () => {
    const devices = deferred();
    const { view, calls, rendered } = createView(method =>
        method === 'getDevices' ? devices.promise : Promise.resolve(response())
    );
    const first = view.refreshLive(false);
    const second = view.refreshLive(false);
    devices.resolve(response([device('shared')]));
    await Promise.all([first, second]);
    assert.equal(calls.filter(call => call.method === 'getDevices').length, 1);
    assert.deepEqual(rendered, ['shared']);
});

test('device cache expires after five seconds and manual refresh bypasses it', async () => {
    const { view, calls, advance } = createView(() => Promise.resolve(response()));
    const deviceCalls = () => calls.filter(call => call.method === 'getDevices').length;
    await view.refreshLive(false);
    advance(1000);
    await view.refreshLive(false);
    assert.equal(deviceCalls(), 1);
    advance(4000);
    await view.refreshLive(false);
    assert.equal(deviceCalls(), 2);
    await view.refreshLive(true);
    assert.equal(deviceCalls(), 3);
});
