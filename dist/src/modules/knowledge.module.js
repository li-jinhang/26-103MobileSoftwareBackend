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
exports.KnowledgeModule = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const app_response_1 = require("../common/app-response");
const app_exception_1 = require("../common/app-exception");
const auth_guard_1 = require("../common/auth.guard");
const helpers_1 = require("../common/helpers");
const prisma_service_1 = require("../prisma/prisma.service");
class ArticleListQueryDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ArticleListQueryDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ArticleListQueryDto.prototype, "keyword", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ArticleListQueryDto.prototype, "status", void 0);
class CorrectionDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CorrectionDto.prototype, "content", void 0);
let KnowledgeService = class KnowledgeService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getCategories() {
        const categories = await this.prisma.knowledgeCategory.findMany({
            orderBy: {
                sortOrder: 'asc'
            }
        });
        return (0, app_response_1.ok)(categories.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description
        })));
    }
    async getArticles(userId, query) {
        const favoriteIds = await this.getFavoriteIds(userId);
        const keyword = query.keyword?.trim().toLowerCase();
        const status = query.status ?? 'published';
        const categoryId = query.categoryId;
        const articles = await this.prisma.knowledgeArticle.findMany({
            where: {
                status
            }
        });
        const filtered = articles
            .filter((item) => !categoryId || categoryId === 'all' || item.categoryId === categoryId)
            .filter((item) => {
            if (!keyword) {
                return true;
            }
            return [item.title, item.summary, item.content, item.categoryName]
                .join(' ')
                .toLowerCase()
                .includes(keyword);
        })
            .map((item) => this.toArticleResponse(item, favoriteIds));
        return (0, app_response_1.ok)(filtered);
    }
    async getArticle(userId, id) {
        const article = await this.prisma.knowledgeArticle.findUnique({
            where: {
                id
            }
        });
        if (!article) {
            throw new app_exception_1.AppException(1004, '文章不存在', common_1.HttpStatus.NOT_FOUND);
        }
        return (0, app_response_1.ok)(this.toArticleResponse(article, await this.getFavoriteIds(userId)));
    }
    async favorite(userId, articleId, favorite) {
        await this.ensureArticleExists(articleId);
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        if (!user) {
            throw new app_exception_1.AppException(1002, '未登录或 Token 无效', common_1.HttpStatus.UNAUTHORIZED);
        }
        const favorites = new Set((0, helpers_1.parseJsonArray)(user.favoriteKnowledgeIdsJson));
        if (favorite) {
            favorites.add(articleId);
        }
        else {
            favorites.delete(articleId);
        }
        await this.prisma.user.update({
            where: {
                id: userId
            },
            data: {
                favoriteKnowledgeIdsJson: (0, helpers_1.toJson)(Array.from(favorites))
            }
        });
        return (0, app_response_1.ok)({
            articleId,
            favorite
        }, favorite ? '收藏成功' : '取消收藏成功');
    }
    async createCorrection(userId, articleId, content) {
        await this.ensureArticleExists(articleId);
        const correction = await this.prisma.knowledgeCorrection.create({
            data: {
                id: `correction-${Date.now()}`,
                articleId,
                userId,
                content,
                createTime: (0, helpers_1.formatDateTime)()
            }
        });
        return (0, app_response_1.ok)({
            id: correction.id,
            articleId: correction.articleId,
            content: correction.content,
            createTime: correction.createTime
        }, '提交成功');
    }
    async ensureArticleExists(articleId) {
        const article = await this.prisma.knowledgeArticle.findUnique({
            where: {
                id: articleId
            }
        });
        if (!article) {
            throw new app_exception_1.AppException(1004, '文章不存在', common_1.HttpStatus.NOT_FOUND);
        }
    }
    async getFavoriteIds(userId) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        });
        return user ? (0, helpers_1.parseJsonArray)(user.favoriteKnowledgeIdsJson) : [];
    }
    toArticleResponse(item, favoriteIds) {
        return {
            id: item.id,
            title: item.title,
            summary: item.summary,
            content: item.content,
            categoryId: item.categoryId,
            categoryName: item.categoryName,
            tags: (0, helpers_1.parseJsonArray)(item.tagsJson),
            updateTime: item.updateTime,
            version: item.version,
            status: item.status,
            attachments: (0, helpers_1.parseJsonArray)(item.attachmentsJson),
            relatedWorkflowIds: (0, helpers_1.parseJsonArray)(item.relatedWorkflowIdsJson),
            favorite: favoriteIds.includes(item.id)
        };
    }
};
KnowledgeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], KnowledgeService);
let KnowledgeController = class KnowledgeController {
    constructor(knowledgeService) {
        this.knowledgeService = knowledgeService;
    }
    async getCategories() {
        return this.knowledgeService.getCategories();
    }
    async getArticles(request, query) {
        return this.knowledgeService.getArticles(request.user.id, query);
    }
    async getArticle(request, id) {
        return this.knowledgeService.getArticle(request.user.id, id);
    }
    async favorite(request, id) {
        return this.knowledgeService.favorite(request.user.id, id, true);
    }
    async unfavorite(request, id) {
        return this.knowledgeService.favorite(request.user.id, id, false);
    }
    async createCorrection(request, id, body) {
        return this.knowledgeService.createCorrection(request.user.id, id, body.content);
    }
};
__decorate([
    (0, common_1.Get)('categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('articles'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ArticleListQueryDto]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "getArticles", null);
__decorate([
    (0, common_1.Get)('articles/:id'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "getArticle", null);
__decorate([
    (0, common_1.Post)('articles/:id/favorite'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "favorite", null);
__decorate([
    (0, common_1.Delete)('articles/:id/favorite'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "unfavorite", null);
__decorate([
    (0, common_1.Post)('articles/:id/corrections'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CorrectionDto]),
    __metadata("design:returntype", Promise)
], KnowledgeController.prototype, "createCorrection", null);
KnowledgeController = __decorate([
    (0, common_1.Controller)('knowledge'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [KnowledgeService])
], KnowledgeController);
let KnowledgeModule = class KnowledgeModule {
};
exports.KnowledgeModule = KnowledgeModule;
exports.KnowledgeModule = KnowledgeModule = __decorate([
    (0, common_1.Module)({
        controllers: [KnowledgeController],
        providers: [KnowledgeService, auth_guard_1.AuthGuard, prisma_service_1.PrismaService]
    })
], KnowledgeModule);
//# sourceMappingURL=knowledge.module.js.map