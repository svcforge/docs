# Gateway 插件

Gateway 内置插件链。所有插件默认关闭，只有配置在 `gateway.plugins` 或单条 route 的 `plugins` 中才会运行。

## 全局插件

全局插件会作用于之后注册的业务路由。`/health` 和插件自己挂载的端点，例如 `/metrics`，不会经过全局插件链。

```yaml
gateway:
  plugins:
    - name: recovery
    - name: access_log
      config:
        skip_paths: ["/health"]
    - name: cors
      config:
        allow_origins: ["https://app.example.com"]
    - name: rate_limit
      config:
        max: 100
        window: 1m
    - name: api_key
      config:
        keys: ["${API_KEY}"]
    - name: jwt
      config:
        secret: "${JWT_SECRET}"
        issuer: my-app
    - name: metrics
```

## 内置插件

| 插件 | 作用 |
| --- | --- |
| `recovery` | 捕获 panic，并返回标准 `INTERNAL` 错误响应。 |
| `access_log` | 输出每个请求的结构化日志，支持 `skip_paths`。 |
| `cors` | 跨域配置，支持 origin、method、header、credentials、max age。 |
| `rate_limit` | 基于客户端 IP 的内存滑动窗口限流，配置 `max` 和 `window`。 |
| `api_key` | Header 或 query API key 校验，配置 `keys`、`header`、`query`。 |
| `jwt` | Bearer token 校验，支持 HS256/384/512、issuer、audience。 |
| `metrics` | Prometheus counter 与 latency histogram，默认暴露 `/metrics`。 |

## 路由插件

单条路由可以声明自己的插件链。路由插件在全局插件之后、代理 handler 之前运行：

```yaml
gateway:
  routes:
    - method: POST
      path: /api/v1/orders
      target: 127.0.0.1:9000
      rpc: /order.v1.OrderService/Create
      plugins:
        - name: api_key
          config:
            keys: ["${ORDER_API_KEY}"]
```

## 禁用插件

使用 `enabled: false` 可以保留配置但不运行：

```yaml
gateway:
  plugins:
    - name: jwt
      enabled: false
      config:
        secret: "${JWT_SECRET}"
```

## 自定义插件

项目可以在 Gateway 初始化前注册自定义插件：

```go
import "github.com/svcforge/service-forge/transport/gateway/plugin"

plugin.MustRegister("tenant-header", func(ctx plugin.BuildContext) (plugin.Plugin, error) {
    tenant, err := ctx.Settings.String("tenant", "")
    if err != nil {
        return plugin.Plugin{}, err
    }
    return plugin.Plugin{Handler: func(c *fiber.Ctx) error {
        c.Set("X-Tenant", tenant)
        return c.Next()
    }}, nil
})
```

然后在配置中启用：

```yaml
gateway:
  plugins:
    - name: tenant-header
      config:
        tenant: acme
```
