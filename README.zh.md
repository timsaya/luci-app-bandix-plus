# LuCI Bandix Plus

[English](README.md) | 简体中文

[![License](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
![Downloads](https://gh-down-badges.linkof.link/timsaya/luci-app-bandix-plus)

## 重要提示

**`bandix-plus` 核心未开源。**

## 简介

LuCI Bandix Plus 是 `bandix-plus` 的 LuCI 前端，面向 OpenWrt 的流量监控与限速管理。
相较于 `luci-app-bandix`，**LuCI Bandix Plus 更强调多网口场景**。


本项目在 LuCI 的 **网络 → Bandix Plus** 页面提供以下能力：

- 多接口并行监控与管理
- 接口流量总览（上传 / 下载）
- 设备列表与用量排行
- 流量时间线与历史统计
- 接口限速
- 定时限速规则
- 来宾控制规则与白名单

典型支持接口包括：物理网口、VLAN 子接口、PPPoE WAN、VPN/隧道接口等。

## 截图

![总览](docs/images/overview.png)

![设备流量趋势](docs/images/trend_device.png)

![用量排行](docs/images/usage_ranking.png)

![流量时间线](docs/images/traffic_timeline.png)

## 系统要求

- OpenWrt（已安装 LuCI）
- 已安装并运行 `bandix-plus` 后端服务
- 内核支持 eBPF

建议：

- 使用流量统计功能前，关闭硬件流量卸载 / Turbo ACC。

## 安装

请先装后端，再装前端：

```bash
opkg install bandix-plus_*.ipk
opkg install luci-app-bandix-plus_*.ipk
```

安装后：

1. 打开 LuCI：**网络 → Bandix Plus**
2. 配置需要监控的接口
3. 确认 `bandix-plus` 服务已启用

## 说明

- 本包依赖：`luci-base`、`luci-lib-jsonc`、`curl`、`bandix-plus`。

## 许可证

Apache 2.0，详见 [LICENSE](LICENSE)。
