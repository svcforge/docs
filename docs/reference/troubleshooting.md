# 排查问题

本页收集 Service Forge 使用过程中的常见问题。

## svcforge proto gen 提示 buf 未安装

`svcforge proto gen` 会调用本机的 `buf generate`。如果提示未安装，需要先安装 `buf`，再重新执行：

```bash
svcforge proto gen
```

## go mod tidy 找不到 service-forge

如果框架还没有发布，生成项目需要通过 `replace` 指向本地 `service-forge` 仓库。

在 `service-forge` 仓库内运行：

```bash
go run ./cmd/svcforge new demo
```

生成的 `go.mod` 会自动包含：

```go
replace github.com/svcforge/service-forge => ..
```

如果项目创建在其他目录，创建时传入：

```bash
svcforge new demo --replace /path/to/service-forge
```

## Gateway 能启动，但接口没有响应

先确认 Gateway 进程正在监听默认端口：

```bash
curl http://localhost:8080/api/v1/ping
```

如果改过配置，检查：

```yaml
gateway:
  listen_ip: 0.0.0.0
  port: 8080
```

## 真实基础设施连接失败

把 provider 从 memory/noop 切换为真实组件后，需要确认 `modules` 下的配置也已经补齐。

例如 Redis：

```yaml
runtime:
  components:
    - name: cache
      provider: redis

modules:
  redis:
    addr: localhost:6379
```

## doctor 检查失败

`svcforge doctor` 当前检查三个路径：

```text
go.mod
config/
api/proto/
```

请在生成项目根目录运行，而不是在 `service-forge` 框架源码目录或服务子目录运行。
