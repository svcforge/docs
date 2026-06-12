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
