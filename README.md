# SupplyChain Hub

面向中小企业的供应链与物流协同平台，覆盖供应商、仓库库存、运单追踪、RBAC 权限和审计日志。

## 主要功能

- 供应链总览仪表盘：在途、待签收、低库存、活跃供应商、状态分布与预警列表。
- 供应商管理：搜索筛选、审核、评分、详情与关联运单。
- 采购订单：按供应商 + 目标仓库提交多行订单，审核后订购数量冻结。
- 分批到货闭环：仓库按唯一批次号登记到货数/合格数，拒收品只留痕、合格品入目标仓库；超收或批次重复整次不生效；部分到货/关闭状态自动流转，关闭后不可改单，并发到货仅一次成功。
- 库存管理：仓库维度库存查询、入库、出库、调拨、盘点和安全库存预警。
- 运单追踪：运单列表、状态流转、发货、在途、签收自动入库、异常和取消。
- 横切能力：JWT 登录、角色权限、前端路由守卫、按钮级 `v-permission`、统一异常处理、审计日志。

## 采购订单与分批到货闭环

### 状态流转

```text
PENDING_APPROVAL ──审核通过──▶ APPROVED ──首批合格入库──▶ PARTIAL_RECEIVED ──全部行收齐──▶ CLOSED
      │                            ▲                           │
      └────取消──▶ CANCELLED       └────整批全拒收（合格=0）─────┘
```

- **下单（采购经理）**：选择供应商与目标仓库，提交多行明细（SKU、名称、正整数订购量，同单 SKU 不可重复）；黑名单供应商、停用仓库不可下单。
- **审核（管理员）**：审核通过后订购数量冻结，仅 `PENDING_APPROVAL` 可改单/取消，审核后任何修改被拒绝。
- **登记到货（仓库经理）**：填写**全局唯一批次号** + 每行到货数、合格数。
  - 合格数 ≤ 到货数；拒收数 = 到货数 − 合格数，**拒收品只在批次记录中留痕，不进入库存**。
  - 仅合格品按 SKU 入订单的目标仓库。
  - **累计合格不得超过订购**：超收、批次号重复、含非本单 SKU 等任一情况发生时，整次登记不生效——已执行的入库全部静默回滚，订单与库存保持原样，也不产生批次记录。
  - 行状态：`PENDING 待到货 / PARTIAL 部分到货 / DONE 已收齐`；订单汇总展示每行订购、累计合格、待收和进度条，全部行收齐才 `CLOSED`。
- **关闭后**：不能改单、不能继续登记到货。
- **并发安全**：同一采购单的到货登记通过单据级互斥锁（`backend/src/utils/lock.ts`）串行执行；同批次号或会导致超收的并发请求只有一次成功，另一次整批拒绝。
- 采购单详情页（`/purchase-orders/:id`）展示每行订购/累计合格/待收/进度、批次历史（含拒收数）与流转时间线，所有数据由后端实时汇总，刷新后一致。

### 权限

| 权限码 | 管理员 | 采购经理 | 仓库经理 |
|--------|--------|----------|----------|
| `purchase-order:read` | ✅ | ✅ | ✅ |
| `purchase-order:write`（建单/改单/取消） | ✅ | ✅ | — |
| `purchase-order:approve`（审核冻结） | ✅ | — | — |
| `purchase-order:receive`（登记到货入库） | ✅ | — | ✅ |

### API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/purchase-orders` | 列表（orderNo/supplierId/warehouseId/status 筛选） |
| POST | `/api/v1/purchase-orders` | 建单 |
| GET | `/api/v1/purchase-orders/:id` | 详情（含每行累计合格、待收、进度、批次） |
| PUT | `/api/v1/purchase-orders/:id` | 改单（仅待审核） |
| POST | `/api/v1/purchase-orders/:id/approve` | 审核通过并冻结数量 |
| POST | `/api/v1/purchase-orders/:id/cancel` | 取消（仅待审核） |
| POST | `/api/v1/purchase-orders/:id/receipts` | 登记一批到货（整批事务性生效） |

## 快速启动

```bash
cp .env.example .env
docker compose up -d
```

访问地址：

- 前端：http://localhost:38201
- 后端健康检查：http://localhost:38301/api/v1/health
- MySQL：localhost:3306
- Redis：localhost:6379

验证账号：

- 管理员：admin / admin123
- 采购经理：purchase / purchase123
- 仓库经理：warehouse / warehouse123

## 本地开发

```bash
cd backend
npm install
npm run dev

cd ../frontend
npm install
npm run dev
```

前端本地开发通过 Vite proxy 将 `/api` 转发到 `http://localhost:38301`。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3, Vite, TypeScript, Pinia, Vue Router, Axios |
| 后端 | Node.js, Express, TypeScript, JWT |
| 数据库脚本 | MySQL 8 SQL migration + seed |
| 缓存/依赖 | Redis 7 |
| 部署 | Docker Compose, Nginx |

## 项目结构

```text
.
├── backend/
│   ├── src/controllers/
│   ├── src/services/
│   ├── src/routes/
│   ├── src/models/
│   ├── src/middlewares/
│   └── src/constants/
├── frontend/
│   ├── src/api/
│   ├── src/stores/
│   ├── src/pages/
│   ├── src/components/common/
│   ├── src/router/
│   └── src/constants/
│   ├── database/
│   │   ├── migrations/001_initial.sql
│   │   ├── migrations/002_purchase_orders.sql
│   │   ├── seeds/001_initial_data.sql
│   │   └── seeds/002_purchase_orders.sql
├── docker-compose.yml
├── .env
└── .env.example
```

## 环境变量说明

```env
# Compose 项目名（确保中文目录下正常启动）
COMPOSE_PROJECT_NAME=wjescm

# 前端端口
FRONTEND_PORT=38201

# 后端端口
BACKEND_PORT=38301

# 数据库配置
DB_ROOT_PASSWORD=root123456
DB_NAME=supplychain_hub
DB_USER=wjescm
DB_PASSWORD=wjescm123456
DB_PORT=3306

# Redis 配置
REDIS_PORT=6379

# JWT 配置
JWT_SECRET=your-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=7d
```

## Docker 部署说明

`docker-compose.yml` 不包含 `version` 字段，顶层声明 `name: wjescm`，并通过 `.env` 中的 `COMPOSE_PROJECT_NAME=wjescm` 保证中文目录名下容器名稳定。数据库与 Redis 使用命名卷，前端 Nginx 将 `/api` 反向代理到 `backend:38301`。

## 枚举出现位置清单

### ShipmentStatus

| 位置 | 文件路径 |
|------|---------|
| 后端枚举定义 | backend/src/constants/enums.ts |
| 后端实体 | backend/src/models/shipment.entity.ts |
| 后端服务 | backend/src/services/shipments.service.ts |
| 后端控制器 | backend/src/controllers/shipments.controller.ts |
| 前端枚举定义 | frontend/src/constants/enums.ts |
| 前端类型 | frontend/src/types/shipment.d.ts |
| 前端组件 | frontend/src/components/common/StatusBadge.vue |
| 前端页面 | frontend/src/pages/Shipments.vue |
| 前端页面 | frontend/src/pages/ShipmentDetail.vue |
| 前端页面 | frontend/src/pages/Dashboard.vue |
| 数据库迁移 | database/migrations/001_initial.sql |
| 种子数据 | database/seeds/001_initial_data.sql |

### SupplierStatus

| 位置 | 文件路径 |
|------|---------|
| 后端枚举定义 | backend/src/constants/enums.ts |
| 后端实体 | backend/src/models/supplier.entity.ts |
| 后端服务 | backend/src/services/suppliers.service.ts |
| 后端控制器 | backend/src/controllers/suppliers.controller.ts |
| 前端枚举定义 | frontend/src/constants/enums.ts |
| 前端类型 | frontend/src/types/supplier.d.ts |
| 前端组件 | frontend/src/components/common/StatusBadge.vue |
| 前端页面 | frontend/src/pages/Suppliers.vue |
| 数据库迁移 | database/migrations/001_initial.sql |

### InventoryAlertLevel

| 位置 | 文件路径 |
|------|---------|
| 后端枚举定义 | backend/src/constants/enums.ts |
| 后端实体 | backend/src/models/inventory.entity.ts |
| 后端服务 | backend/src/services/inventory.service.ts |
| 前端枚举定义 | frontend/src/constants/enums.ts |
| 前端类型 | frontend/src/types/inventory.d.ts |
| 前端组件 | frontend/src/components/common/StatusBadge.vue |
| 前端页面 | frontend/src/pages/Inventory.vue |
| 前端页面 | frontend/src/pages/Dashboard.vue |
| 数据库迁移 | database/migrations/001_initial.sql |

## License

MIT
