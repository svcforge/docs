# CLI 命令

`svcforge` 是 Service Forge 的脚手架入口。当前命令包括：

```text
svcforge new <project>
svcforge add service <name>
svcforge proto gen
svcforge doctor
```

## svcforge new

创建一个新的 Service Forge 项目：

```bash
svcforge new demo
```

默认生成本地友好的运行时组件：

| 组件 | 默认 provider |
| --- | --- |
| store | noop |
| cache | memory |
| eventbus | memory |
| registry | memory |
| tracing | noop |

可以在创建时直接选择真实基础设施：

```bash
svcforge new demo \
  --db postgres \
  --cache redis \
  --mq rabbitmq \
  --registry consul \
  --tracing otel
```

常用参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--db` | `noop` | 数据存储 provider。 |
| `--cache` | `memory` | 缓存 provider。 |
| `--mq` | `memory` | 消息队列 provider。 |
| `--registry` | `memory` | 服务注册 provider。 |
| `--tracing` | `noop` | 链路追踪 provider。 |
| `--replace` | 自动检测 | 本地开发时替换 `github.com/svcforge/service-forge` 的路径。 |

## svcforge add service

在已有项目中添加 gRPC-only 服务骨架：

```bash
svcforge add service order-service
```

会创建：

```text
api/proto/order-service/v1/order-service.proto
services/order-service/cmd/main.go
services/order-service/internal/README.md
```

推荐服务内部结构：

```text
services/<service>/
├── cmd/
└── internal/
    ├── handler/rpc
    ├── service
    ├── repository
    ├── model
    └── setup
```

## svcforge proto gen

运行 `buf generate` 生成 protobuf 代码：

```bash
svcforge proto gen
```

生成结果会写入：

```text
api/gen/go
```

如果未安装 `buf`，命令会直接返回错误。

## svcforge doctor

检查当前目录是否具备 Service Forge 项目的基础结构：

```bash
svcforge doctor
```

当前检查项：

- `go.mod`
- `config/`
- `api/proto/`

通过时会输出：

```text
Service Forge project looks ok
```
