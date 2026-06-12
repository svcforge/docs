---
layout: home

hero:
  name: Service Forge
  text: Go 微服务框架与脚手架工具
  tagline: 用 Core、Ports、Adapters 与 Runtime Modules 组织微服务项目，把业务代码和基础设施选择解耦。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看架构
      link: /guide/architecture

features:
  - title: gRPC 优先
    details: 业务服务只暴露 gRPC，REST/JSON 入口集中在 Gateway 层。
  - title: 端口与适配器
    details: 业务逻辑依赖 ports 接口，Redis、Postgres、RabbitMQ、Consul、OTel 等实现可替换。
  - title: 配置驱动运行时
    details: Runtime components 通过配置选择 provider，并在应用启动时装配成模块。
---

<div class="hero-architecture">
  <div class="hero-architecture__row">
    <div class="hero-architecture__node">Client</div>
    <div class="hero-architecture__arrow">→</div>
    <div class="hero-architecture__node">REST/JSON Gateway</div>
  </div>
  <div class="hero-architecture__row">
    <div class="hero-architecture__node">gRPC Services</div>
    <div class="hero-architecture__arrow">→</div>
    <div class="hero-architecture__node">Ports</div>
  </div>
  <div class="hero-architecture__node hero-architecture__wide">Adapters + Runtime Modules</div>
</div>

## 适合什么项目

Service Forge 适合正在从单体应用走向服务化，或者希望从第一天就保持清晰边界的 Go 项目。它不强迫业务代码直接绑定某个数据库、缓存、消息队列或注册中心，而是把基础设施能力抽象为端口，再由运行时配置选择适配器。

<div class="doc-grid">
  <div class="doc-tile">
    <strong>新项目脚手架</strong>
    <p>用 `svcforge new` 创建带 Gateway、示例服务、配置和 buf 文件的基础项目。</p>
  </div>
  <div class="doc-tile">
    <strong>服务增量生成</strong>
    <p>用 `svcforge add service` 添加 gRPC-only 服务骨架，保持统一目录约定。</p>
  </div>
  <div class="doc-tile">
    <strong>运行时替换</strong>
    <p>本地可用 memory/noop，生产可切换到 Redis、Postgres、RabbitMQ、Consul、OTel。</p>
  </div>
</div>

## 推荐阅读顺序

1. 阅读 [快速开始](/guide/getting-started)，创建并运行第一个项目。
2. 阅读 [架构说明](/guide/architecture)，理解 Gateway、gRPC Services、Ports 和 Adapters 的分工。
3. 阅读 [运行时组件](/guide/runtime-components)，学习如何切换基础设施 provider。
4. 阅读 [扩展组件](/guide/extension)，注册自己的 provider。
