# 快速开始

本页从本地开发场景开始，演示如何使用 `svcforge` 生成项目、启动 Gateway 与示例服务。

## 前置条件

- Go 已安装。
- 如果要生成 protobuf 代码，需要额外安装 `buf`。
- 当前 `service-forge` 仓库还在本地开发时，建议从仓库内运行 CLI。

## 安装或运行 CLI

如果 Service Forge 已发布，可以使用：

```bash
go install github.com/svcforge/service-forge/cmd/svcforge@latest
```

本地开发时，在 `service-forge` 仓库内运行：

```bash
go run ./cmd/svcforge --help
```

也可以构建本地二进制：

```bash
go build -o ./bin/svcforge ./cmd/svcforge
./bin/svcforge --help
```

## 创建项目

在 `service-forge` 仓库内创建示例项目：

```bash
go run ./cmd/svcforge new demo
cd demo
go mod tidy
```

生成的 `go.mod` 会自动包含本地 replace：

```go
replace github.com/svcforge/service-forge => ..
```

如果你在其他目录创建项目，并且框架还没有发布，需要显式传入本地框架路径：

```bash
svcforge new demo --replace /path/to/service-forge
```

框架发布并打 tag 后，可以删除本地 replace，并使用真实版本：

```bash
go get github.com/svcforge/service-forge@latest
```

## 启动项目

启动 REST/JSON Gateway：

```bash
go run ./gateway/cmd
```

在另一个终端启动示例 gRPC 服务：

```bash
go run ./services/example-service/cmd
```

访问生成的 Gateway 路由：

```bash
curl http://localhost:8080/api/v1/ping
```

期望响应：

```json
{"code":"OK","message":"ok","data":{"message":"pong"},"timestamp":...}
```

## 使用配置代理到 gRPC

除了在 Gateway 代码里手写路由，也可以在 `config/base.yaml` 中声明 API 到 gRPC 的转发规则：

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

这条配置里的 `rpc` 还需要在 Gateway 入口注册静态 invoker。实际项目中这段代码可以由 CLI 根据 protobuf 生成结果自动生成：

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

如果使用 `service` 而不是 `target`，Gateway 会通过 registry 查找后端服务：

```yaml
gateway:
  routes:
    - method: POST
      path: /api/v1/ping
      service: example-service
      rpc: /example.v1.ExampleService/Ping
```

本地用 `memory` registry 时，Gateway 和 gRPC 服务分别是两个进程，内存注册表不会共享。此时请使用 `target` 直连，或切换到 Consul。

## 下一步

运行起来之后，建议继续阅读：

- [CLI 命令](/guide/cli)：了解 `new`、`add service`、`proto gen`、`doctor`。
- [配置系统](/guide/configuration)：了解配置文件加载顺序和本地覆盖。
- [运行时组件](/guide/runtime-components)：把 memory/noop 切换为真实基础设施。
