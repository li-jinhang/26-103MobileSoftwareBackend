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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const app_exception_1 = require("./app-exception");
let AuthGuard = class AuthGuard {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            throw new app_exception_1.AppException(1002, '未登录或 Token 无效', common_1.HttpStatus.UNAUTHORIZED);
        }
        const token = authHeader.slice(7).trim();
        if (!token) {
            throw new app_exception_1.AppException(1002, '未登录或 Token 无效', common_1.HttpStatus.UNAUTHORIZED);
        }
        const session = await this.prisma.session.findFirst({
            where: {
                token,
                revokedAt: null,
                expiresAt: {
                    gt: new Date()
                }
            },
            include: {
                user: true
            }
        });
        if (!session) {
            throw new app_exception_1.AppException(1002, '未登录或 Token 无效', common_1.HttpStatus.UNAUTHORIZED);
        }
        request.token = token;
        request.user = {
            id: session.user.id,
            name: session.user.name,
            role: session.user.role
        };
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map