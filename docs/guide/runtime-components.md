# 运行时组件

Service Forge 通过 `runtime.components` 选择需要启动的组件，以及每个组件使用的 provider。

## 默认组件

生成项目默认使用适合本地开发的 provider：

```yaml
runtime:
  components:
    - name: store
      provider: noop
    - name: cache
      provider: memory
    - name: eventbus
      provider: memory
    - name: registry
      provider: memory
    - name: tracing
      provider: noop
```

## 可用 provider

<table class="adapter-table">
  <thead>
    <tr>
      <th>组件</th>
      <th>Provider</th>
      <th>适用场景</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>store</td>
      <td>noop, postgres</td>
      <td>本地跳过存储，或连接 PostgreSQL。</td>
    </tr>
    <tr>
      <td>cache</td>
      <td>noop, memory, redis</td>
      <td>本地内存缓存，或连接 Redis。</td>
    </tr>
    <tr>
      <td>eventbus</td>
      <td>noop, memory, rabbitmq</td>
      <td>本地内存事件，或连接 RabbitMQ。</td>
    </tr>
    <tr>
      <td>registry</td>
      <td>noop, memory, consul</td>
      <td>本地注册表，或连接 Consul。</td>
    </tr>
    <tr>
      <td>tracing</td>
      <td>noop, otel</td>
      <td>关闭追踪，或使用 OpenTelemetry。</td>
    </tr>
  </tbody>
</table>

## 切换为真实基础设施

在 `config/base.yaml` 中修改 provider：

```yaml
runtime:
  components:
    - name: store
      provider: postgres
    - name: cache
      provider: redis
    - name: eventbus
      provider: rabbitmq
    - name: registry
      provider: consul
    - name: tracing
      provider: otel
```

然后补充对应模块配置：

```yaml
modules:
  postgres:
    host: localhost
    port: 5432
    user: postgres
    password: postgres
    database: demo
    sslmode: disable
  redis:
    addr: localhost:6379
  rabbitmq:
    url: amqp://guest:guest@localhost:5672/
    exchange: events
  consul:
    address: localhost:8500
```

## 临时禁用组件

可以保留组件配置，但不启动它：

```yaml
runtime:
  components:
    - name: eventbus
      provider: rabbitmq
      enabled: false
```

`enabled` 省略时默认启用。
