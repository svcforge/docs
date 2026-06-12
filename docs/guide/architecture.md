# 架构说明

Service Forge 的默认架构是：

```text
Client -> REST/JSON Gateway -> gRPC Services -> Ports -> Adapters
```

## 分层职责

| 层级 | 职责 |
| --- | --- |
| Client | 调用 REST/JSON API 的外部客户端。 |
| Gateway | 对外暴露 REST/JSON 路由，负责 HTTP 请求处理与统一响应。 |
| gRPC Services | 承载业务服务边界，对内暴露 gRPC。 |
| Ports | 定义业务需要的接口，例如缓存、存储、事件总线、注册中心、链路追踪。 |
| Adapters | 端口接口的具体实现，例如 Redis、Postgres、RabbitMQ、Consul、OTel。 |
| Runtime Modules | 应用启动时装配、初始化、启动和停止的运行时组件。 |

## 为什么 Gateway 和服务分离

业务服务只暴露 gRPC，REST/JSON 路由集中在 Gateway，这样可以让外部 API 形态和内部服务协议分开演进。

这种边界带来几个直接好处：

- Gateway 可以统一处理 HTTP 路由、响应格式、跨域、中间件和错误映射。
- 服务端可以专注业务能力，并通过 protobuf 明确契约。
- 内部服务调用可以保持 gRPC，不需要每个服务重复维护 REST 层。

## 配置驱动的 API 转发

Gateway 支持通过 `gateway.routes` 声明 REST/JSON 到 gRPC 的代理规则。框架会在启动时自动挂载 HTTP 路由，请求到达后通过 Gateway 二进制中注册的静态 invoker 调用生成后的 protobuf client。

```yaml
gateway:
  routes:
    - name: example-ping
      method: POST
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      timeout: 3s
```

请求 JSON body、query 参数和 path 参数会合并到 protobuf request 字段中，gRPC 响应会包装成 Service Forge 标准 JSON 响应。

每个配置里的 `rpc` 都需要 Gateway 二进制注册对应的静态 invoker。这样运行时不需要 gRPC server reflection，也不需要动态 protobuf descriptor。配置只负责声明 HTTP 路由和后端，真正的 protobuf 绑定和 gRPC client 调用由生成后的 Go 代码完成。

## Ports 与 Adapters

业务代码应该依赖 `ports/*` 下的接口，而不是直接依赖某个基础设施 SDK。这样本地开发可以使用 memory/noop provider，生产环境再切换为真实 provider。

例如缓存能力可以由以下 provider 提供：

| 端口 | 本地 provider | 生产 provider |
| --- | --- | --- |
| cache | memory、noop | redis |
| store | noop | postgres |
| eventbus | memory、noop | rabbitmq |
| registry | memory、noop | consul |
| tracing | noop | otel |

## Application 生命周期

`core/app` 负责统一管理模块生命周期：

```text
Init -> Start -> 等待 SIGINT/SIGTERM -> Stop
```

模块通过 `app.WithModules(...)` 注入应用。应用停止时会按相反顺序关闭模块，方便先启动的基础设施最后释放。

## 健康检查

应用会把模块注册到健康检查 registry 中。每个模块可以通过自己的 `Health(ctx)` 方法报告状态，应用层通过 `Application.Health(ctx)` 聚合结果。
