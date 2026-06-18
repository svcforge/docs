# 配置系统

Service Forge 使用 YAML 配置，并在启动时把多个文件合并成一个配置对象。

## 加载顺序

`config.Load` 默认从 `config/` 目录加载文件：

```text
base.yaml
envs/<environment>.yaml
services/<serviceName>.yaml
local.yaml
```

加载顺序越靠后，优先级越高。不存在的文件会被跳过。

## 环境选择

如果调用时没有传入 `Environment`，框架会读取 `APP_ENV`。如果 `APP_ENV` 也为空，则使用：

```text
development
```

## 常用配置

生成项目的基础配置示例：

```yaml
app:
  name: demo
  version: v0.1.0
  env: development
  debug: true

gateway:
  listen_ip: 0.0.0.0
  port: 8080
  disable_startup_message: true
  plugins:
    - name: recovery
    - name: access_log
      config:
        skip_paths: ["/health"]
    - name: metrics
  routes:
    - name: example-ping
      method: POST
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      pool_size: 1
      timeout: 3s

log:
  format: text
  level: info
  module_lifecycle: false

grpc:
  listen_ip: 0.0.0.0
  port: 9000
```

## Gateway 路由配置

`gateway.routes` 用来声明 REST/JSON 到 gRPC 的转发规则：

| 字段 | 说明 |
| --- | --- |
| `name` | 路由名称，可选，用于日志和排查。 |
| `method` | HTTP 方法，省略时默认 `POST`。 |
| `path` | HTTP 路径，支持 Fiber path 参数，例如 `/api/v1/users/:id`。 |
| `target` | 直连 gRPC 地址，例如 `127.0.0.1:9000`。 |
| `service` | 通过 registry 解析的服务名。 |
| `rpc` | 完整 gRPC 方法名，例如 `/example.v1.ExampleService/Ping`。 |
| `pool_size` | 直连 `target` 时创建的 gRPC ClientConn 数量，默认 `1`。 |
| `timeout` | 单次代理调用超时，可选，例如 `3s`。 |
| `load_balance` | `pool_size > 1` 时连接选择策略，可选，见[路由弹性治理](#路由弹性治理)。 |
| `retry` | 失败重试策略，可选，默认关闭。 |
| `circuit_breaker` | 熔断策略，可选，默认关闭。 |
| `stream` | 流式代理类型：`bidi` 为 WebSocket↔gRPC 双向流，`sse` 为服务端流式（Server-Sent Events）。见[WebSocket 流式代理](#websocket-流式代理)与[服务端流式（SSE）](#服务端流式-sse)。 |

每条 `rpc` 需要注册静态 invoker：

```go
gateway.MustRegisterProxyInvoker("/example.v1.ExampleService/Ping", gateway.NewUnaryProxy(
    func() *examplev1.PingRequest {
        return &examplev1.PingRequest{}
    },
    func(ctx context.Context, conn *grpc.ClientConn, req *examplev1.PingRequest) (*examplev1.PingResponse, error) {
        return examplev1.NewExampleServiceClient(conn).Ping(ctx, req)
    },
))
```

Gateway 不访问后端 gRPC server reflection，也不在运行时解析动态 descriptor。后续可以由 CLI 根据生成的 protobuf Go 代码自动生成这段注册代码。

性能敏感路径推荐生成 `NewUnaryCodecProxy` 注册代码，由生成代码直接绑定 request 字段并写出 response JSON：

```go
gateway.MustRegisterProxyInvoker("/example.v1.ExampleService/Ping", gateway.NewUnaryCodecProxy(
    func() *examplev1.PingRequest { return &examplev1.PingRequest{} },
    func() *examplev1.PingResponse { return &examplev1.PingResponse{} },
    func(c *fiber.Ctx, req *examplev1.PingRequest) error {
        return nil
    },
    func(ctx context.Context, conn *grpc.ClientConn, req *examplev1.PingRequest, resp *examplev1.PingResponse) error {
        return conn.Invoke(ctx, "/example.v1.ExampleService/Ping", req, resp)
    },
    func(c *fiber.Ctx, resp *examplev1.PingResponse) error {
        return gateway.WriteSuccessJSON(c, []byte(`{"message":"pong"}`))
    },
))
```

本地多进程开发时，`registry: memory` 只在当前进程内有效。Gateway 和服务分开运行时，建议使用 `target` 直连，或者切换到 Consul 这类共享 registry 后再使用 `service`。

请求参数会按以下顺序合并到 protobuf request：

1. JSON body。
2. query 参数，不覆盖 body 中已有字段。
3. path 参数，不覆盖 body 或 query 中已有字段。

## 路由弹性治理

每条路由都可以单独开启重试、熔断和负载均衡。三者默认全部关闭，不配置时不产生任何额外开销。失败按框架错误码分类，因此 `INVALID_ARGUMENT` 这类客户端错误既不会被重试，也不会计入熔断统计。

### 重试

失败后在重新挑选的连接上重试，自动绕开坏端点：

```yaml
gateway:
  routes:
    - name: example-ping
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      retry:
        max_attempts: 3      # 含首次的总尝试次数，<= 1 表示关闭
        per_try_timeout: 1s  # 单次尝试超时，省略时回退到路由 timeout
        backoff: 50ms        # 每次重试前的固定间隔，0 表示立即重试
        retry_on:            # 可安全重试的框架错误码
          - UNAVAILABLE
          - DEADLINE_EXCEEDED
```

`retry_on` 省略时默认为 `UNAVAILABLE` 和 `DEADLINE_EXCEEDED`。只对幂等 RPC 开启重试：一个瞬时的 `UNAVAILABLE` 仍有可能已经在后端生效。

### 熔断

当滚动窗口内的失败率超过阈值时跳闸，之后的请求直接以 `UNAVAILABLE` 短路返回，直到一次探测成功为止。熔断包在重试之外，因此「重试耗尽后仍失败」只计为一次熔断失败：

```yaml
gateway:
  routes:
    - name: example-ping
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      circuit_breaker:
        min_requests: 20        # 窗口内达到此调用数后才可能跳闸
        failure_ratio: 0.5      # 触发跳闸的失败比例，区间 (0,1]
        window: 10s             # closed 状态下统计调用的滚动窗口
        open_timeout: 5s        # open 持续多久后放行一次 half-open 探测
        half_open_max_calls: 1  # half-open 状态允许的并发探测数
```

只有服务端/传输类失败（`UNAVAILABLE`、`DEADLINE_EXCEEDED`、`INTERNAL`）会计入跳闸，客户端错误永远不会打开熔断器。

### 负载均衡

当 `pool_size` 大于 `1` 时，`load_balance` 决定请求如何分散到连接池：

```yaml
gateway:
  routes:
    - name: example-ping
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      pool_size: 4
      load_balance: least_conn  # round_robin（默认）| least_conn | random
```

`round_robin` 按顺序轮询连接；`least_conn` 选择在途请求数最少的连接，在请求延迟不均时更优；`random` 均匀随机。未知或空值回退为 `round_robin`。

## WebSocket 流式代理

将路由的 `stream` 设为 `bidi`，即可把一条 WebSocket 连接桥接到 gRPC 双向流。除了配置，还需要注册一个流式 invoker，提供每帧的消息类型：

```yaml
gateway:
  routes:
    - name: chat
      path: /ws/chat
      target: 127.0.0.1:9000
      rpc: /example.v1.Chat/Stream
      stream: bidi
```

```go
gateway.MustRegisterBidiStreamProxy("/example.v1.Chat/Stream",
    func() proto.Message { return &chatv1.ServerMessage{} }, // server → client 每帧类型
    func() proto.Message { return &chatv1.ClientMessage{} }, // client → server 每帧类型
)
```

该路由以 HTTP upgrade 方式暴露为 WebSocket 端点，非 upgrade 请求返回 `426 Upgrade Required`。两个方向由各自的 goroutine 独立泵送，任一侧关闭都会解除另一侧的阻塞。

**编码协商**：编码方式由客户端的**第一帧**决定，并在整条连接生命周期内固定：

| 客户端首帧类型 | client → server | server → client |
| --- | --- | --- |
| 文本帧（text） | protojson（JSON）解码 | protojson 编码，写回文本帧 |
| 二进制帧（binary） | proto wire format 解码 | proto wire format 编码，写回二进制帧 |

同一个路由可同时接受文本和二进制客户端，每条连接独立协商，互不影响。客户端选择二进制编码时，payload 通常比 JSON 小 30–40%，适合移动端或高频消息场景。

需要注意：

- 重试和单次调用超时对流不生效；配置了熔断时也只在**建流阶段**参与，不作用于流中途的每一帧。
- 每条流在建立时从连接池选定一条连接，并在整条流生命周期内固定使用。
- 路由级插件（鉴权等）在 upgrade 前的 HTTP 握手阶段执行。
- 关闭 WebSocket 会半关闭 gRPC 流；服务端流结束（`io.EOF`）会关闭 WebSocket。

## 服务端流式（SSE）

对于单向的服务端流式，将 `stream` 设为 `sse`。该路由接收**一个**请求（与 unary 路由一样从 body/query/path 绑定），然后把每条 gRPC 响应消息以 Server-Sent Event 的形式推送给客户端：

```yaml
gateway:
  routes:
    - name: feed
      path: /sse/feed
      target: 127.0.0.1:9000
      rpc: /example.v1.Feed/Stream
      stream: sse
```

```go
gateway.MustRegisterServerStreamProxy("/example.v1.Feed/Stream",
    func() proto.Message { return &feedv1.FeedRequest{} }, // 单个请求
    func() proto.Message { return &feedv1.FeedEvent{} },   // 每条推送事件
)
```

响应使用 `Content-Type: text/event-stream`，每条 gRPC 消息写成一个 `data: <json>` 事件。流式路由默认使用 HTTP `GET`（这样浏览器 `EventSource` 可直接使用），除非显式设置 `method`。gRPC 流结束（`io.EOF`）会关闭响应；客户端断开会在下一帧 flush 时被检测到。

约束与 WebSocket 一致：重试和单次超时不生效，配置了熔断时也只在建流阶段参与，路由级插件在流开始前执行。

## Gateway 插件配置

`gateway.plugins` 是全局插件链。插件默认关闭，只有出现在配置里的插件才会运行，并且按配置顺序执行：

```yaml
gateway:
  plugins:
    - name: recovery
    - name: access_log
      config:
        skip_paths: ["/health"]
    - name: rate_limit
      config:
        max: 100
        window: 1m
    - name: api_key
      config:
        keys: ["${API_KEY}"]
    - name: metrics
```

路由也可以声明自己的插件链，运行在全局链之后、当前路由 handler 之前：

```yaml
gateway:
  routes:
    - method: POST
      path: /api/v1/ping
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      plugins:
        - name: api_key
          config:
            keys: ["${PING_API_KEY}"]
```

插件配置项支持 `enabled: false`，用于保留配置但暂时不启用。

## 服务名覆盖

启动服务时可以传入 `ServiceName`：

```go
bundle, err := config.Load[struct{}](config.LoadOptions{
    ConfigDir:   "config",
    ServiceName: "example-service",
    EnableLocal: true,
})
```

当 `ServiceName` 不为空时，核心配置里的 `app.name` 会被设置为当前服务名。

## 应用自定义配置

`config.Load[T]` 支持把同一份合并后的 YAML 同时解码到应用自己的配置结构：

```go
type AppConfig struct {
    Payment struct {
        Timeout string `yaml:"timeout"`
    } `yaml:"payment"`
}

bundle, err := config.Load[AppConfig](config.LoadOptions{
    ConfigDir: "config",
})
if err != nil {
    log.Fatal(err)
}

fmt.Println(bundle.App.Payment.Timeout)
```

## 模块配置

适配器可以通过 `config.ModuleConfig[T]` 读取 `modules.<name>` 下的配置：

```go
cfg, err := config.ModuleConfig[RedisConfig](bundle.Core, "redis")
```

这种方式让核心配置保持稳定，同时允许不同 adapter 拥有自己的配置结构。

## 日志

默认日志较安静，模块生命周期日志和 Fiber 启动 banner 都是关闭的。

调试模块启动过程：

```yaml
log:
  format: text
  level: debug
  module_lifecycle: true
```

生产环境可以使用 JSON：

```yaml
log:
  format: json
  level: info
```
