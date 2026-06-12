# 项目结构

`svcforge new demo` 会生成一个可运行的基础项目。

## 顶层结构

```text
demo/
├── api/
│   └── proto/
├── config/
│   └── base.yaml
├── gateway/
│   └── cmd/
├── services/
│   └── example-service/
├── buf.yaml
├── buf.gen.yaml
├── go.mod
└── README.md
```

## api

`api/proto` 存放 protobuf 定义。执行 `svcforge proto gen` 后，Go 代码会生成到：

```text
api/gen/go
```

## gateway

Gateway 是 REST/JSON 入口。生成项目中的 `gateway/cmd/main.go` 会：

1. 加载配置。
2. 创建 Gateway 模块。
3. 构建运行时组件。
4. 把 Gateway 追加到模块列表。
5. 启动应用生命周期。

## services

业务服务放在 `services/<service>/` 下。推荐结构：

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

各目录职责：

| 目录 | 职责 |
| --- | --- |
| `cmd` | 服务启动入口。 |
| `handler/rpc` | gRPC server 实现。 |
| `service` | 业务逻辑，依赖 ports 接口。 |
| `repository` | 持久化细节。 |
| `model` | 领域或数据模型。 |
| `setup` | adapter 组装与依赖注入。 |

## config

`config/base.yaml` 是基础配置。可以继续添加：

```text
config/envs/development.yaml
config/envs/production.yaml
config/services/example-service.yaml
config/local.yaml
```

`local.yaml` 通常用于本机覆盖，不建议提交敏感信息。

## buf 文件

生成项目包含：

```text
buf.yaml
buf.gen.yaml
```

它们定义 protobuf 模块和 Go/gRPC 代码生成规则。
