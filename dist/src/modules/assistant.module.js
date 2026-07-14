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
exports.AssistantModule = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const app_response_1 = require("../common/app-response");
const auth_guard_1 = require("../common/auth.guard");
const helpers_1 = require("../common/helpers");
const prisma_service_1 = require("../prisma/prisma.service");
class AskDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], AskDto.prototype, "question", void 0);
let AssistantService = class AssistantService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ask(userId, question) {
        const keyword = question.trim();
        let reply;
        if (keyword.includes('报销') || keyword.includes('打车') || keyword.includes('发票')) {
            reply = {
                answer: '根据《差旅报销制度》，报销需上传发票、行程截图和事由说明。你可以直接发起“报销申请”。',
                relatedKnowledgeIds: ['k2'],
                recommendedWorkflowId: 'wf2'
            };
        }
        else if (keyword.includes('请假') || keyword.includes('病假') || keyword.includes('年假')) {
            reply = {
                answer: '请假前建议先查看《请假制度说明》，确认请假类型和材料要求，然后发起“请假申请”。',
                relatedKnowledgeIds: ['k1'],
                recommendedWorkflowId: 'wf1'
            };
        }
        else if (keyword.includes('权限') || keyword.includes('账号') || keyword.includes('系统')) {
            reply = {
                answer: '系统权限开通需要说明业务场景、系统名称和期限范围，建议先阅读《系统权限申请规范》并发起“权限申请”。',
                relatedKnowledgeIds: ['k4'],
                recommendedWorkflowId: 'wf4'
            };
        }
        else if (keyword.includes('采购') || keyword.includes('预算') || keyword.includes('合同')) {
            reply = {
                answer: '采购流程需补充用途、预算和期望到货时间，可参考《采购申请规范》后发起“采购申请”。',
                relatedKnowledgeIds: ['k3'],
                recommendedWorkflowId: 'wf3'
            };
        }
        else {
            reply = {
                answer: '我已经为你检索到相关知识入口。当前基础版本采用关键词匹配，后续可以接入更完整的智能问答能力。',
                relatedKnowledgeIds: ['k1', 'k2'],
                recommendedWorkflowId: 'wf1'
            };
        }
        await this.prisma.assistantHistory.create({
            data: {
                id: `ah${Date.now()}`,
                userId,
                question,
                answer: reply.answer,
                relatedKnowledgeIdsJson: (0, helpers_1.toJson)(reply.relatedKnowledgeIds),
                recommendedWorkflowId: reply.recommendedWorkflowId,
                time: (0, helpers_1.formatDateTime)()
            }
        });
        return (0, app_response_1.ok)(reply);
    }
};
AssistantService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssistantService);
let AssistantController = class AssistantController {
    constructor(assistantService) {
        this.assistantService = assistantService;
    }
    async ask(request, body) {
        return this.assistantService.ask(request.user.id, body.question);
    }
};
__decorate([
    (0, common_1.Post)('ask'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, AskDto]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "ask", null);
AssistantController = __decorate([
    (0, common_1.Controller)('assistant'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [AssistantService])
], AssistantController);
let AssistantModule = class AssistantModule {
};
exports.AssistantModule = AssistantModule;
exports.AssistantModule = AssistantModule = __decorate([
    (0, common_1.Module)({
        controllers: [AssistantController],
        providers: [AssistantService, auth_guard_1.AuthGuard, prisma_service_1.PrismaService]
    })
], AssistantModule);
//# sourceMappingURL=assistant.module.js.map