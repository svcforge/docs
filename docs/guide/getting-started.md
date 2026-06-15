# 快速开始

本文从零开始，带你用 `svcforge` CLI 生成一个项目、实现一个 gRPC 方法，并通过 Gateway 以 REST/JSON 暴露出去。全程使用内置的 `memory` / `noop` 组件，**不需要任何外部依赖**（数据库、消息队列等都可后续再接）。

整体目标：

```text
curl → Gateway(REST/JSON) → gRPC 服务(ExampleService.Ping) → 返回
```

## 前置条件

- Go 1.23 及以上。
- 仅当你要生成 protobuf 代码时，额外安装 [`buf`](https://buf.build/docs/installation)。
- 如果 `service-forge` 框架还没发布到代理，建议在仓库内运行 CLI（见下一步）。

## 1. 获取 CLI

框架已发布时，直接安装：

```bash
go install github.com/svcforge/service-forge/cmd/svcforge@latest
svcforge --help
```

本地开发（在 `service-forge` 仓库内）可以直接运行，无需安装：

```bash
go run ./cmd/svcforge --help
```

CLI 提供四个命令：`new`（创建项目）、`add service`（添加服务）、`proto gen`（生成 protobuf 代码）、`doctor`（检查项目结构）。

## 2. 生成项目

```bash
go run ./cmd/svcforge new demo
cd demo
go mod tidy
```

`new` 支持选择各组件的适配器，省略时使用括号内的默认值：

| Flag | 说明 | 默认 |
| --- | --- | --- |
| `--db` | 存储适配器（如 `postgres`） | `noop` |
| `--cache` | 缓存适配器（如 `redis`） | `memory` |
| `--mq` | 消息队列适配器（如 `rabbitmq`） | `memory` |
| `--registry` | 服务注册适配器（如 `consul`） | `memory` |
| `--tracing` | 链路追踪适配器（如 `otel`） | `noop` |
| `--replace` | 本地框架路径，框架未发布时使用 | 自动探测 |

在 `service-forge` 仓库内创建时，生成的 `go.mod` 会自动加上指向本地框架的 `replace`：

```go
replace github.com/svcforge/service-forge => ..
```

在其他目录创建且框架未发布时，需显式传入框架路径：

```bash
svcforge new demo --replace /path/to/service-forge
```

## 3. 了解项目结构

```text
demo/
├── go.mod
├── buf.yaml                 # buf 模块定义
├── buf.gen.yaml             # protobuf 代码生成配置（输出到 api/gen/go）
├── config/
│   └── base.yaml            # 基础配置：gateway / grpc / 组件 / 模块
├── api/
│   └── proto/example/v1/
│       └── example.proto    # 示例 proto：ExampleService.Ping
├── gateway/
│   └── cmd/main.go          # Gateway 进程入口（对外 REST/JSON）
└── services/
    └── example-service/
        ├── cmd/main.go      # gRPC 服务进程入口
        └── internal/        # 业务实现（handler / service / repository ...）
```

约定：**Gateway 对外暴露 REST/JSON，业务服务只暴露 gRPC**，两者是独立进程。业务逻辑依赖 `ports/*` 接口，基础设施由 adapter 按配置装配。

## 4. 先把骨架跑起来

生成的 Gateway 入口里内置了一条手写路由 `GET /api/v1/ping`，可以先验证骨架可用。

打开一个终端启动 Gateway：

```bash
go run ./gateway/cmd
```

另开一个终端启动示例 gRPC 服务：

```bash
go run ./services/example-service/cmd
```

请求内置路由：

```bash
curl http://localhost:8080/api/v1/ping
```

期望返回标准响应信封：

```json
{"code":"OK","message":"ok","data":{"message":"pong"},"timestamp":1718000000}
```

> 这条 `pong` 是 Gateway 代码里手写返回的，还没有经过 gRPC。下面我们实现真正的 gRPC 方法并接通它。

## 5. 定义你的 RPC

打开 `api/proto/example/v1/example.proto`，它已经声明了一个 `Ping` 方法：

```protobuf
syntax = "proto3";

package example.v1;

option go_package = "demo/api/gen/go/example/v1;examplev1";

service ExampleService {
  rpc Ping(PingRequest) returns (PingResponse);
}

message PingRequest {
  string message = 1;
}

message PingResponse {
  string message = 1;
}
```

实际项目中，你在这里增删消息和方法。本教程沿用 `Ping`，让它把收到的 `message` 原样回显。

## 6. 生成 protobuf 代码

```bash
go run ../cmd/svcforge proto gen   # 在 demo 目录内；或安装后用 svcforge proto gen
```

该命令在 `buf` 已安装时执行 `buf generate`，根据 `buf.gen.yaml` 把代码生成到 `api/gen/go/`：

```text
api/gen/go/example/v1/
├── example.pb.go         # 消息类型 PingRequest / PingResponse
└── example_grpc.pb.go    # ExampleServiceServer / Client、Register 函数
```

生成后记得同步依赖：

```bash
go mod tidy
```

## 7. 实现 gRPC 服务

新建 `services/example-service/internal/handler/example.go`，实现生成出来的 `ExampleServiceServer` 接口（内嵌 `Unimplemented...` 以便前向兼容）：

```go
package handler

import (
	"context"

	examplev1 "demo/api/gen/go/example/v1"
)

type Server struct {
	examplev1.UnimplementedExampleServiceServer
}

func (s *Server) Ping(ctx context.Context, req *examplev1.PingRequest) (*examplev1.PingResponse, error) {
	return &examplev1.PingResponse{Message: req.GetMessage()}, nil
}
```

在 `services/example-service/cmd/main.go` 里，把它注册到 gRPC server——`grpcserver.NewModule` 接收若干 `func(*grpc.Server)` 注册函数：

```go
import (
	examplev1 "demo/api/gen/go/example/v1"
	"demo/services/example-service/internal/handler"
	"google.golang.org/grpc"
	// ...保留原有 import
)

// ...
mods = append(mods, grpcserver.NewModule(
	func(s *grpc.Server) {
		examplev1.RegisterExampleServiceServer(s, &handler.Server{})
	},
))
```

## 8. 通过 Gateway 暴露成 REST

分两步：声明路由，再注册静态 invoker。

### 8.1 声明路由

在 `config/base.yaml` 的 `gateway.routes` 下加入（直连本地 gRPC 服务）：

```yaml
gateway:
  routes:
    - name: example-echo
      method: POST
      path: /api/v1/echo
      target: 127.0.0.1:9000
      rpc: /example.v1.ExampleService/Ping
      timeout: 3s
```

### 8.2 注册 invoker

路由里的 `rpc` 需要一个静态 invoker 把 HTTP 请求绑定成 protobuf 并调用 gRPC。在 `gateway/cmd/main.go` 的 `main()` 中、`app.Run` 之前加入：

```go
import (
	examplev1 "demo/api/gen/go/example/v1"
	"google.golang.org/grpc"
	// ...保留原有 import
)

gateway.MustRegisterProxyInvoker("/example.v1.ExampleService/Ping", gateway.NewUnaryProxy(
	func() *examplev1.PingRequest { return &examplev1.PingRequest{} },
	func(ctx context.Context, conn *grpc.ClientConn, req *examplev1.PingRequest) (*examplev1.PingResponse, error) {
		return examplev1.NewExampleServiceClient(conn).Ping(ctx, req)
	},
))
```

> Gateway 转发走静态生成的 Go 代码，不使用 gRPC 反射或运行时动态 descriptor，因此请求路径上没有反射开销。请求的 JSON body、query、path 参数会按字段名合并进 protobuf 请求。

## 9. 端到端验证

重启两个进程（`Ctrl+C` 后重新 `go run`），然后请求新的代理路由：

```bash
curl -X POST http://localhost:8080/api/v1/echo \
  -H 'Content-Type: application/json' \
  -d '{"message":"hi"}'
```

期望返回（`data` 来自真正的 gRPC 调用）：

```json
{"code":"OK","message":"ok","data":{"message":"hi"},"timestamp":1718000000}
```

到这里你已经走通了完整链路：REST 请求 → Gateway → gRPC 服务 → 回显。

## 10. 添加更多服务

```bash
svcforge add service orders
```

这会生成 `api/proto/orders/v1/orders.proto`、`services/orders/cmd/main.go` 和 `services/orders/internal/README.md`。随后重复第 6–8 步：`proto gen` → 实现 handler → 在服务入口注册 → 在 Gateway 声明路由与 invoker。

可以随时用 `doctor` 检查项目基本结构是否完整：

```bash
svcforge doctor
```

## 11. 切换到真实基础设施

默认的 `memory` / `noop` 适配器适合本地开发。接入真实组件有两种方式：

- 创建项目时指定：`svcforge new demo --db postgres --cache redis --registry consul --tracing otel`
- 或修改 `config/base.yaml` 的 `runtime.components` 里各组件的 `provider`，并在 `modules` 段填好对应连接信息。

注意：本地多进程开发且使用 `memory` registry 时，Gateway 与 gRPC 服务是两个进程、内存注册表不共享，此时路由请用 `target` 直连；切换到 Consul 等共享 registry 后才可改用 `service` 名称发现。

## 下一步

- [CLI 命令](/guide/cli)：`new`、`add service`、`proto gen`、`doctor` 的完整说明。
- [配置系统](/guide/configuration)：配置加载顺序、路由弹性治理（重试/熔断/负载均衡）、WebSocket 与 SSE 流式路由。
- [运行时组件](/guide/runtime-components)：把 `memory` / `noop` 换成 Redis、PostgreSQL、RabbitMQ、Consul、OpenTelemetry。
- [Gateway 插件](/guide/gateway-plugins)：recovery、access_log、cors、rate_limit、api_key、jwt、metrics。
