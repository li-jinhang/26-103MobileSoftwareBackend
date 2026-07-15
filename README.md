# MobileSoftwareBackend

基于接口文档与解耦设计文档实现的课程后端，技术栈为 `NestJS + Prisma + SQLite`。

## 启动

```bash
.\start-backend.cmd
```

或在终端中执行：

```bash
npm run backend:up
```

脚本会自动完成以下操作：

- 首次运行时自动安装依赖
- 自动停止当前项目里已运行的后端开发进程，避免 Prisma 引擎文件被占用
- 自动执行 `prisma generate` 与 `prisma migrate deploy`
- 首次创建数据库时自动写入初始示例数据
- 最后启动 `npm run start:dev`

如果需要重置并重新写入示例数据，可执行：

```bash
npm run backend:up:reset
```

服务默认地址：

- API: `http://localhost:26102/api`
- Swagger: `http://localhost:26102/docs`

## 已实现模块

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/knowledge/categories`
- `GET /api/knowledge/articles`
- `GET /api/knowledge/articles/:id`
- `POST /api/knowledge/articles/:id/favorite`
- `DELETE /api/knowledge/articles/:id/favorite`
- `POST /api/knowledge/articles/:id/corrections`
- `GET /api/workflow/templates`
- `GET /api/workflow/instances/my`
- `GET /api/workflow/instances/todo`
- `GET /api/workflow/instances/:id`
- `POST /api/workflow/instances`
- `POST /api/workflow/instances/:id/approve`
- `POST /api/workflow/instances/:id/reject`
- `POST /api/workflow/instances/:id/security-confirm`
- `GET /api/notifications`
- `POST /api/notifications/:id/read`
- `POST /api/assistant/ask`

## 默认测试账号

- 普通员工：`employee01 / 123456`
- 审批人：`manager01 / 123456`
- 系统管理员：`admin01 / 123456`
- 知识管理员：`knowledge01 / 123456`

## 说明

- 所有非登录接口都需要 `Authorization: Bearer <token>`
- 统一响应格式为 `{ code, message, data }`
- 流程审批、驳回、二次确认与通知生成已在后端收口

## Prisma 常见问题

- 在 Windows 下执行 `npx prisma generate` 或 `npx prisma migrate dev` 时，如果出现 `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`，通常是因为正在运行的 `npm run start:dev`、`ts-node-dev` 或其他 Node 进程占用了 Prisma 引擎文件。
- 现在可以直接使用 `.\start-backend.cmd` 或 `npm run backend:up`，脚本会自动停止当前项目相关进程并清理残留的临时引擎文件。
