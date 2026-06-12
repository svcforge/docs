# 基准测试

Service Forge 使用 Go 标准 `testing` benchmark。

## Gateway 代理基准

运行配置式 REST/JSON 到 gRPC 转发基准：

```bash
go test ./transport/gateway -run '^$' -bench . -benchmem
```

当前覆盖：

| Benchmark | 场景 |
| --- | --- |
| `BenchmarkConfiguredRouteProxyToGRPC` | `App.Test` 单线程兼容指标。 |
| `BenchmarkConfiguredRouteProxyToGRPCParallel` | `App.Test` 并发兼容指标。 |
| `BenchmarkConfiguredRouteProxyToGRPCFasthttp` | 更接近生产的 Fiber/fasthttp 单线程路径。 |
| `BenchmarkConfiguredRouteProxyToGRPCFasthttpParallel` | 带 route timeout 的 Fiber/fasthttp 并发路径。 |
| `BenchmarkConfiguredRouteProxyToGRPCFasthttpNoTimeoutParallel` | 不启用 route timeout 的高性能 Fiber/fasthttp 并发路径。 |
| `BenchmarkConfiguredRouteProxyToGRPCFasthttpPooledNoTimeoutParallel` | 多 gRPC ClientConn 池化路径，用于验证单连接是否成为瓶颈。 |

示例输出：

```text
BenchmarkConfiguredRouteProxyToGRPCFasthttpParallel-18             146127    16139 ns/op    11786 B/op    165 allocs/op
BenchmarkConfiguredRouteProxyToGRPCFasthttpNoTimeoutParallel-18    175489    13843 ns/op    10562 B/op    149 allocs/op
```

这些数字和本机 CPU、Go 版本、系统负载有关。提交性能结论时，建议贴出完整 `goos`、`goarch`、`cpu` 和命令。

## 端到端压测

仓库提供 `examples/bench/` 用于复现 wrk 到 Gateway 再到 gRPC backend 的端到端结果。

启动后端和三个网关：

```bash
go run ./examples/bench/backend &
go run ./examples/bench/svcforgegw &
go run ./examples/bench/svcforgegw -port 8082 -plugins core &
go run ./examples/bench/grpcgatewaygw &
```

运行 wrk：

```bash
wrk -t8 -c128 -d10s --latency http://127.0.0.1:8080/api/health
wrk -t8 -c128 -d10s --latency http://127.0.0.1:8081/api/health
wrk -t8 -c128 -d10s --latency -H "X-API-Key: bench-key" http://127.0.0.1:8082/api/health
```

README 记录的结果为 Apple M5 Pro、Go 1.26.2、每组 3 次平均：

| Gateway | Requests/sec | p50 | p99 | Response size |
| --- | ---: | ---: | ---: | ---: |
| Service Forge，无插件 | 97,016 | 1.19ms | 2.27ms | 254 B |
| Service Forge，5 插件开启 | 89,545 | 1.48ms | 3.40ms | 343 B |
| grpc-gateway v2 | 81,779 | 1.50ms | 2.69ms | 174 B |

这些数字属于 REST/JSON 到 gRPC 转发场景，不等同于 Nginx、Envoy 这类纯 HTTP reverse proxy benchmark。
