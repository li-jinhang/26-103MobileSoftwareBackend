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
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const bcrypt = require("bcrypt");
const uuid_1 = require("uuid");
const app_response_1 = require("../common/app-response");
const app_exception_1 = require("../common/app-exception");
const auth_guard_1 = require("../common/auth.guard");
const helpers_1 = require("../common/helpers");
const prisma_service_1 = require("../prisma/prisma.service");
class LoginDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginDto.prototype, "account", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginDto.prototype, "password", void 0);
let AuthService = class AuthService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async login(account, password) {
        const user = await this.prisma.user.findUnique({
            where: {
                account
            }
        });
        if (!user) {
            throw new app_exception_1.AppException(1002, '账号不存在或密码错误', common_1.HttpStatus.UNAUTHORIZED);
        }
        const matched = await bcrypt.compare(password, user.passwordHash);
        if (!matched) {
            throw new app_exception_1.AppException(1002, '账号不存在或密码错误', common_1.HttpStatus.UNAUTHORIZED);
        }
        const token = (0, uuid_1.v4)();
        await this.prisma.session.create({
            data: {
                token,
                userId: user.id,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });
        return (0, app_response_1.ok)({
            token,
            user: await this.buildUserProfile(user.id)
        });
    }
    async me(userId) {
        return (0, app_response_1.ok)(await this.buildUserProfile(userId));
    }
    async logout(token) {
        await this.prisma.session.updateMany({
            where: {
                token,
                revokedAt: null
            },
            data: {
                revokedAt: new Date()
            }
        });
        return (0, app_response_1.ok)(null, '退出成功');
    }
    async buildUserProfile(userId) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if (!user) {
            throw new common_1.UnauthorizedException();
        }
        const todoCount = await this.prisma.workflowInstance.count({
            where: {
                currentApproverRole: user.role,
                status: {
                    in: ['pending', 'in_review', 'pending_security_confirm']
                }
            }
        });
        return {
            id: user.id,
            name: user.name,
            account: user.account,
            department: user.department,
            role: user.role,
            roleLabel: user.roleLabel,
            permissions: (0, helpers_1.parseJsonArray)(user.permissionsJson),
            favoriteKnowledgeIds: (0, helpers_1.parseJsonArray)(user.favoriteKnowledgeIdsJson),
            recentKnowledgeIds: (0, helpers_1.parseJsonArray)(user.recentKnowledgeIdsJson),
            todoCount
        };
    }
};
AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthService);
let AuthController = class AuthController {
    constructor(authService) {
        this.authService = authService;
    }
    async login(body) {
        return this.authService.login(body.account, body.password);
    }
    async me(request) {
        return this.authService.me(request.user.id);
    }
    async logout(request) {
        return this.authService.logout(request.token);
    }
};
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [LoginDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [AuthService])
], AuthController);
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        controllers: [AuthController],
        providers: [AuthService, auth_guard_1.AuthGuard, prisma_service_1.PrismaService]
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map