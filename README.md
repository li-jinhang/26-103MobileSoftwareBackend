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

## 服务器部署

下面的步骤适用于将当前后端项目通过 `git` 部署到 Linux 服务器。

### 1. 服务器准备

先在服务器安装以下环境：

- `git`
- `Node.js 20 LTS`
- `npm`
- `pm2`

可参考以下命令：

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 2. 拉取项目代码

```bash
git clone <你的仓库地址>
cd MobileSoftwareBackend
```

### 3. 配置环境变量

在项目根目录创建 `.env`：

```env
DATABASE_URL="file:./dev.db"
PORT=26102
```

说明：

- 当前项目使用 `SQLite`，数据库文件会按 `DATABASE_URL` 指向的位置创建
- 不要把本地开发机的 `.env` 直接提交到仓库

### 4. 安装依赖并初始化数据库

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

说明：

- `prisma migrate deploy` 用于在服务器上应用已提交的迁移
- `npm run prisma:seed` 用于首次写入示例数据；如果你已经有正式数据，不要重复执行

### 5. 构建并启动服务

```bash
npm run build
pm2 start dist/src/main.js --name mobile-backend
pm2 save
```

说明：

- 当前项目编译后的服务入口文件为 `dist/src/main.js`
- 因此在服务器上不要直接写成 `node dist/main.js`

查看运行状态与日志：

```bash
pm2 status
pm2 logs mobile-backend
```

重启服务：

```bash
pm2 restart mobile-backend
```

### 6. 宝塔面板更简单的部署方式

如果你使用的是宝塔面板，通常可以不用手动写完整的 `pm2` 命令，直接使用宝塔的 `Node 项目` 或 `PM2 管理器`。

推荐方式：

1. 在宝塔中安装 `Node.js 20`
2. 将仓库拉到服务器目录
3. 在项目目录先执行一次初始化：

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run build
```

然后在宝塔中按下面方式配置：

- 项目目录：当前仓库目录
- Node 版本：`20`
- 启动命令：`node dist/src/main.js`
- 端口：`26102`
- 环境变量：
  - `DATABASE_URL=file:./dev.db`
  - `PORT=26102`

如果你用的是宝塔 `PM2 管理器`，启动文件同样填写：

```bash
dist/src/main.js
```

解释器选择 `node` 即可。

额外说明：

- `npm run backend:up` 和 `.\start-backend.cmd` 主要用于本地 Windows 开发环境，不适合直接在宝塔 Linux 环境中使用
- 如果需要通过域名访问，建议在宝塔网站里配置反向代理到 `127.0.0.1:26102`

### 7. 验证部署结果

浏览器访问：

- `http://<服务器IP>:26102/api`
- `http://<服务器IP>:26102/docs`

如果服务器启用了防火墙或安全组，还需要放行 `26102` 端口。

### 8. 注意事项

- `npm run backend:up` 和 `.\start-backend.cmd` 主要用于本地 Windows 开发环境，不适合直接在 Linux 服务器使用
- 当前项目使用 `SQLite`，适合课程作业、演示或轻量部署；如果后续需要多人并发和长期运行，建议再迁移到 `MySQL` 或 `PostgreSQL`
- 建议定期备份服务器上的 SQLite 数据库文件

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
- `GET /api/attendance/today`
- `GET /api/attendance/records/my`
- `POST /api/attendance/check-in`
- `POST /api/attendance/check-out`
- `GET /api/mail/inbox`
- `GET /api/mail/sent`
- `GET /api/mail/:id`
- `POST /api/mail/send`
- `POST /api/mail/:id/read`
- `DELETE /api/mail/:id`
- `POST /api/assistant/ask`

## 默认测试账号

- 普通员工：`employee01 / 123456`
- 审批人：`manager01 / 123456`
- 系统管理员：`admin01 / 123456`
- 知识管理员：`knowledge01 / 123456`
- 其他常用账号：`ceo01 / 123456`、`hr01 / 123456`、`finance01 / 123456`、`sales01 / 123456`、`procurement01 / 123456`

## 说明

- 所有非登录接口都需要 `Authorization: Bearer <token>`
- 统一响应格式为 `{ code, message, data }`
- 流程审批、驳回、二次确认与通知生成已在后端收口

## Prisma 常见问题

- 在 Windows 下执行 `npx prisma generate` 或 `npx prisma migrate dev` 时，如果出现 `EPERM: operation not permitted, rename ... query_engine-windows.dll.node`，通常是因为正在运行的 `npm run start:dev`、`ts-node-dev` 或其他 Node 进程占用了 Prisma 引擎文件。
- 现在可以直接使用 `.\start-backend.cmd` 或 `npm run backend:up`，脚本会自动停止当前项目相关进程并清理残留的临时引擎文件。
