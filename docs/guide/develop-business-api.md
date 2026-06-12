# 开发业务接口

本页用 `order-service` 演示从零开发一个正式业务接口：定义 protobuf、生成代码、实现 gRPC 服务、配置 Gateway HTTP 路由，并完成调用验证。

## 前置条件

先进入已生成的项目目录：

```bash
cd ~/svcforge-demo/demo
```

确认 CLI 可用：

```bash
svcforge --help
```

确认 `buf` 已安装：

```bash
buf --version
```

如果没有安装 `buf`，macOS 可以使用：

```bash
brew install bufbuild/buf/buf
```

也可以用 Go 安装：

```bash
go install github.com/bufbuild/buf/cmd/buf@latest
export PATH="$PATH:$(go env GOPATH)/bin"
```

## 创建服务骨架

使用 CLI 添加订单服务：

```bash
svcforge add service order-service
```

生成的核心文件：

```text
api/proto/order-service/v1/order-service.proto
services/order-service/cmd/main.go
services/order-service/internal/README.md
```

## 定义 protobuf 接口

编辑：

```text
api/proto/order-service/v1/order-service.proto
```

写入订单创建接口：

```proto
syntax = "proto3";

package order_service.v1;

option go_package = "demo/api/gen/go/order-service/v1;order_servicev1";

service OrderService {
  rpc CreateOrder(CreateOrderRequest) returns (CreateOrderResponse);
}

message CreateOrderRequest {
  string user_id = 1;
  string product_id = 2;
  int32 quantity = 3;
}

message CreateOrderResponse {
  string order_id = 1;
  string status = 2;
}
```

生成 Go 代码：

```bash
svcforge proto gen
```

生成结果在：

```text
api/gen/go
```

## 实现 gRPC Handler

创建目录：

```bash
mkdir -p services/order-service/internal/handler/rpc
```

创建文件：

```text
services/order-service/internal/handler/rpc/order.go
```

写入：

```go
package rpc

import (
	"context"

	orderv1 "demo/api/gen/go/order-service/v1"
)

type OrderServer struct {
	orderv1.UnimplementedOrderServiceServer
}

func NewOrderServer() *OrderServer {
	return &OrderServer{}
}

func (s *OrderServer) CreateOrder(ctx context.Context, req *orderv1.CreateOrderRequest) (*orderv1.CreateOrderResponse, error) {
	return &orderv1.CreateOrderResponse{
		OrderId: "order_demo_001",
		Status:  "created",
	}, nil
}
```

## 注册 gRPC 服务

编辑：

```text
services/order-service/cmd/main.go
```

在 import 中加入：

```go
orderv1 "demo/api/gen/go/order-service/v1"
orderRpc "demo/services/order-service/internal/handler/rpc"
"google.golang.org/grpc"
```

把 `grpcserver.NewModule(...)` 改成：

```go
mods = append(mods, grpcserver.NewModule(
	func(server *grpc.Server) {
		orderv1.RegisterOrderServiceServer(server, orderRpc.NewOrderServer())
	},
))
```

## 配置 Gateway 路由

编辑：

```text
config/base.yaml
```

在 `gateway.routes` 下添加：

```yaml
gateway:
  routes:
    - name: create-order
      method: POST
      path: /api/v1/orders
      target: 127.0.0.1:9000
      rpc: /order_service.v1.OrderService/CreateOrder
      timeout: 3s
```

本地多进程开发时，`registry: memory` 不跨进程共享，所以这里使用 `target` 直连 gRPC 服务。

## 注册 Gateway Invoker

Gateway 配置里的 `rpc` 必须对应一个静态 invoker。编辑：

```text
gateway/cmd/main.go
```

在 import 中加入：

```go
orderv1 "demo/api/gen/go/order-service/v1"
"google.golang.org/grpc"
```

在创建 Gateway 之前注册：

```go
gateway.MustRegisterProxyInvoker("/order_service.v1.OrderService/CreateOrder", gateway.NewUnaryProxy(
	func() *orderv1.CreateOrderRequest {
		return &orderv1.CreateOrderRequest{}
	},
	func(ctx context.Context, conn *grpc.ClientConn, req *orderv1.CreateOrderRequest) (*orderv1.CreateOrderResponse, error) {
		return orderv1.NewOrderServiceClient(conn).CreateOrder(ctx, req)
	},
))
```

## 启动并验证

终端 1 启动订单服务：

```bash
go run ./services/order-service/cmd
```

终端 2 启动 Gateway：

```bash
go run ./gateway/cmd
```

终端 3 调用 HTTP API：

```bash
curl -X POST http://localhost:8080/api/v1/orders \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"u001","product_id":"p001","quantity":2}'
```

预期响应：

```json
{"code":"OK","message":"ok","data":{"order_id":"order_demo_001","status":"created"},"timestamp":...}
```

## 推荐目录结构

业务复杂后，不要把逻辑都写在 handler 里。推荐拆成：

```text
services/order-service/internal/
├── handler/rpc      # gRPC handler，只做协议适配
├── service          # 业务逻辑
├── repository       # 持久化访问
├── model            # 领域或数据模型
└── setup            # 依赖组装
```

`handler/rpc` 调用 `service`，`service` 依赖 ports 或 repository，这样后续切换数据库、缓存、消息队列时不会影响接口层。
