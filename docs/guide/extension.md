# 扩展组件

Service Forge 的运行时组件通过 catalog 注册。你可以在默认 catalog 的基础上添加自己的 provider。

## 注册自定义 provider

下面示例为 `eventbus` 注册一个名为 `nats` 的 provider：

```go
catalog := adapters.DefaultCatalog()
catalog.Register("eventbus", "nats", func() module.Module {
    return natsadapter.NewModule()
})

mods, err := catalog.Build(bundle.Core.Runtime.Components)
if err != nil {
    log.Fatal(err)
}
mods = append(mods, gatewayModule)

application := app.New(bundle.Core, app.WithModules(mods...))
```

然后在配置中选择它：

```yaml
runtime:
  components:
    - name: eventbus
      provider: nats
```

## 实现模块

自定义 provider 最终需要返回一个 `module.Module`。模块负责实现自己的生命周期方法：

```go
type Module interface {
    Name() string
    Init(ctx context.Context, app AppContext) error
    Start(ctx context.Context) error
    Stop(ctx context.Context) error
    Health(ctx context.Context) error
}
```

推荐做法：

- `Init` 中读取配置、创建客户端、把端口实现注入应用上下文。
- `Start` 中启动需要后台运行的连接或 worker。
- `Stop` 中释放连接，确保可以被重复安全调用。
- `Health` 中检查连接状态或返回轻量探测结果。

## 注入端口实现

模块可以把端口实现放入应用上下文：

```go
func (m *NatsModule) Init(ctx context.Context, app module.AppContext) error {
    app.Set("eventbus", m.bus)
    return nil
}
```

业务代码可以通过统一 key 获取能力。项目成熟后，也可以在应用层封装更明确的 accessor，减少字符串 key 在业务代码中扩散。

## 扩展建议

- 新 provider 名称使用小写短名，例如 `nats`、`mysql`、`prometheus`。
- 保持端口接口稳定，避免让业务代码感知 provider 的私有类型。
- 为 provider 增加最小可运行测试，覆盖配置解码和模块生命周期。
