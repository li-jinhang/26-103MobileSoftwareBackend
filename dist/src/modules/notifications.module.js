"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const app_response_1 = require("../common/app-response");
const app_exception_1 = require("../common/app-exception");
const auth_guard_1 = require("../common/auth.guard");
const helpers_1 = require("../common/helpers");
const prisma_service_1 = require("../prisma/prisma.service");
class NotificationQueryDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === 'true' || value === true),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], NotificationQueryDto.prototype, "unreadOnly", void 0);
let NotificationsService = class NotificationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(role, unreadOnly) {
        const notifications = await this.prisma.notification.findMany({
            where: unreadOnly
                ? {
                    read: false
                }
                : undefined
        });
        return (0, app_response_1.ok)(notifications
            .filter((item) => (0, helpers_1.parseJsonArray)(item.targetRolesJson).includes(role))
            .map((item) => ({
            id: item.id,
            title: item.title,
            content: item.content,
            time: item.time,
            read: item.read,
            targetRoles: (0, helpers_1.parseJsonArray)(item.targetRolesJson),
            targetType: item.targetType,
            targetId: item.targetId
        })));
    }
    async read(role, id) {
        const notification = await this.prisma.notification.findUnique({
            where: {
                id
            }
        });
        if (!notification) {
            throw new app_exception_1.AppException(1004, '消息不存在', common_1.HttpStatus.NOT_FOUND);
        }
        if (!(0, helpers_1.parseJsonArray)(notification.targetRolesJson).includes(role)) {
            throw new app_exception_1.AppException(1003, '无权限访问', common_1.HttpStatus.FORBIDDEN);
        }
        const updated = await this.prisma.notification.update({
            where: {
                id
            },
            data: {
                read: true
            }
        });
        return (0, app_response_1.ok)({
            id: updated.id,
            read: updated.read
        }, '标记成功');
    }
};
NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsService);
let NotificationsController = class NotificationsController {
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    async list(request, query) {
        return this.notificationsService.list(request.user.role, query.unreadOnly);
    }
    async read(request, id) {
        return this.notificationsService.read(request.user.role, id);
    }
};
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, NotificationQueryDto]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/read'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "read", null);
NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [NotificationsService])
], NotificationsController);
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        controllers: [NotificationsController],
        providers: [NotificationsService, auth_guard_1.AuthGuard, prisma_service_1.PrismaService]
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map