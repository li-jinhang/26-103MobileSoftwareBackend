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
exports.WorkflowModule = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const app_response_1 = require("../common/app-response");
const app_exception_1 = require("../common/app-exception");
const auth_guard_1 = require("../common/auth.guard");
const helpers_1 = require("../common/helpers");
const prisma_service_1 = require("../prisma/prisma.service");
class CreateWorkflowDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "extraInput", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "dateInput", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateWorkflowDto.prototype, "amountInput", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "reasonInput", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateWorkflowDto.prototype, "attachmentInput", void 0);
class CommentDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CommentDto.prototype, "comment", void 0);
let WorkflowService = class WorkflowService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getTemplates() {
        const templates = await this.prisma.workflowTemplate.findMany();
        return (0, app_response_1.ok)(templates.map((item) => this.toTemplateResponse(item)));
    }
    async getMyInstances(userId) {
        const items = await this.prisma.workflowInstance.findMany({
            where: {
                applicantId: userId
            },
            include: {
                approvalRecords: true
            }
        });
        return (0, app_response_1.ok)(items.map((item) => this.toInstanceResponse(item)));
    }
    async getTodoInstances(role) {
        const items = await this.prisma.workflowInstance.findMany({
            where: {
                currentApproverRole: role,
                status: {
                    in: ['pending', 'in_review', 'pending_security_confirm']
                }
            },
            include: {
                approvalRecords: true
            }
        });
        return (0, app_response_1.ok)(items.map((item) => this.toInstanceResponse(item)));
    }
    async getInstance(id) {
        const item = await this.prisma.workflowInstance.findUnique({
            where: {
                id
            },
            include: {
                approvalRecords: {
                    orderBy: {
                        time: 'asc'
                    }
                }
            }
        });
        if (!item) {
            throw new app_exception_1.AppException(1004, '流程不存在', common_1.HttpStatus.NOT_FOUND);
        }
        return (0, app_response_1.ok)(this.toInstanceResponse(item));
    }
    async createInstance(userId, userName, body) {
        const template = await this.prisma.workflowTemplate.findUnique({
            where: {
                id: body.templateId
            }
        });
        if (!template) {
            throw new app_exception_1.AppException(1004, '流程模板不存在', common_1.HttpStatus.NOT_FOUND);
        }
        if (!body.title.trim()) {
            throw new app_exception_1.AppException(1001, '参数错误', common_1.HttpStatus.BAD_REQUEST);
        }
        const amount = Number(body.amountInput ?? 0);
        if (Number.isNaN(amount)) {
            throw new app_exception_1.AppException(1001, '金额格式错误', common_1.HttpStatus.BAD_REQUEST);
        }
        const defaultApproverRoles = (0, helpers_1.parseJsonArray)(template.defaultApproverRolesJson);
        const requiresSecurityConfirm = this.requiresSecurityConfirm(template.id, amount);
        const riskReason = this.getRiskReason(template.id, amount);
        const formDetail = this.buildFormDetail(template.id, body, amount);
        const formSummary = this.buildFormSummary(template.id, body, amount);
        const id = `i${Date.now()}`;
        const now = new Date();
        const created = await this.prisma.workflowInstance.create({
            data: {
                id,
                templateId: template.id,
                title: `${template.name} - ${body.title.trim()}`,
                applicantId: userId,
                applicantName: userName,
                status: 'pending',
                currentNode: '等待部门负责人审批',
                currentApproverRole: defaultApproverRoles[0] ?? 'approver',
                createTime: (0, helpers_1.formatDateTime)(now),
                latestComment: '已从移动端发起流程。',
                relatedKnowledgeIdsJson: template.relatedKnowledgeIdsJson,
                amount,
                formSummary,
                formDetailJson: (0, helpers_1.toJson)(formDetail),
                riskLevel: requiresSecurityConfirm ? 'high' : 'normal',
                riskReason,
                requiresSecurityConfirm,
                securityConfirmed: false,
                approvalRecords: {
                    create: [
                        {
                            id: `ar${Date.now()}`,
                            nodeName: '提交流程',
                            operatorRole: 'employee',
                            operatorName: userName,
                            decision: 'submitted',
                            comment: '提交了新的流程申请。',
                            time: (0, helpers_1.formatDateTime)(now)
                        }
                    ]
                }
            },
            include: {
                approvalRecords: true
            }
        });
        await this.createNotification(`${template.name}待处理`, `${userName}提交了“${created.title}”，请尽快审批。`, ['approver'], 'workflow', created.id);
        return (0, app_response_1.ok)({
            id: created.id,
            templateId: created.templateId,
            title: created.title,
            status: created.status,
            currentNode: created.currentNode,
            requiresSecurityConfirm: created.requiresSecurityConfirm
        }, '提交流程成功');
    }
    async approveInstance(user, id, comment) {
        const instance = await this.requireOperableInstance(id, user.role);
        if (instance.status === 'pending_security_confirm') {
            throw new app_exception_1.AppException(1005, '当前流程需走二次安全确认', common_1.HttpStatus.BAD_REQUEST);
        }
        const next = this.getApprovalTransition(instance.templateId, instance.amount, user.name);
        const latestComment = comment?.trim()
            ? `${user.name}：${comment.trim()}`
            : next.latestComment;
        const updated = await this.prisma.workflowInstance.update({
            where: {
                id
            },
            data: {
                status: next.status,
                currentNode: next.currentNode,
                currentApproverRole: next.currentApproverRole,
                latestComment,
                approvalRecords: {
                    create: [
                        {
                            id: `ar${Date.now()}`,
                            nodeName: instance.currentNode,
                            operatorRole: user.role,
                            operatorName: user.name,
                            decision: 'approved',
                            comment: comment?.trim() || '审批通过',
                            time: (0, helpers_1.formatDateTime)()
                        }
                    ]
                }
            }
        });
        if (next.status === 'in_review' || next.status === 'pending_security_confirm') {
            await this.createNotification('流程待处理', `“${instance.title}”已流转至下一节点，请尽快处理。`, [next.currentApproverRole], 'workflow', instance.id);
        }
        await this.createNotification('流程状态更新', `你的流程“${instance.title}”状态已更新为${this.statusLabel(next.status)}。`, [instance.applicant.role], 'workflow', instance.id);
        return (0, app_response_1.ok)({
            id: updated.id,
            status: updated.status,
            currentNode: updated.currentNode,
            latestComment: updated.latestComment
        }, '审批成功');
    }
    async rejectInstance(user, id, comment) {
        const instance = await this.requireOperableInstance(id, user.role);
        const rejectComment = comment?.trim() || '流程已驳回';
        const updated = await this.prisma.workflowInstance.update({
            where: {
                id
            },
            data: {
                status: 'rejected',
                currentNode: '流程已驳回',
                latestComment: `${user.name}：${rejectComment}`,
                approvalRecords: {
                    create: [
                        {
                            id: `ar${Date.now()}`,
                            nodeName: instance.currentNode,
                            operatorRole: user.role,
                            operatorName: user.name,
                            decision: 'rejected',
                            comment: rejectComment,
                            time: (0, helpers_1.formatDateTime)()
                        }
                    ]
                }
            }
        });
        await this.createNotification('流程被驳回', `你的流程“${instance.title}”已被驳回，请查看原因并重新提交。`, [instance.applicant.role], 'workflow', instance.id);
        return (0, app_response_1.ok)({
            id: updated.id,
            status: updated.status,
            currentNode: updated.currentNode,
            latestComment: updated.latestComment
        }, '驳回成功');
    }
    async securityConfirm(user, id, comment) {
        const instance = await this.prisma.workflowInstance.findUnique({
            where: {
                id
            },
            include: {
                applicant: true
            }
        });
        if (!instance) {
            throw new app_exception_1.AppException(1004, '流程不存在', common_1.HttpStatus.NOT_FOUND);
        }
        if (user.role !== 'systemAdmin') {
            throw new app_exception_1.AppException(1003, '无权限访问', common_1.HttpStatus.FORBIDDEN);
        }
        if (instance.status !== 'pending_security_confirm') {
            throw new app_exception_1.AppException(1005, '业务状态不允许当前操作', common_1.HttpStatus.BAD_REQUEST);
        }
        const latestComment = comment?.trim()
            ? `${user.name}：${comment.trim()}`
            : `${user.name} 已完成二次确认。`;
        const updated = await this.prisma.workflowInstance.update({
            where: {
                id
            },
            data: {
                status: 'approved',
                currentNode: '流程结束',
                latestComment,
                securityConfirmed: true,
                approvalRecords: {
                    create: [
                        {
                            id: `ar${Date.now()}`,
                            nodeName: '二次安全确认',
                            operatorRole: user.role,
                            operatorName: user.name,
                            decision: 'security_confirmed',
                            comment: comment?.trim() || '已完成二次确认。',
                            time: (0, helpers_1.formatDateTime)()
                        }
                    ]
                }
            }
        });
        await this.createNotification('流程已完成', `你的流程“${instance.title}”已完成二次确认并通过。`, [instance.applicant.role], 'workflow', instance.id);
        return (0, app_response_1.ok)({
            id: updated.id,
            status: updated.status,
            currentNode: updated.currentNode,
            securityConfirmed: updated.securityConfirmed,
            latestComment: updated.latestComment
        }, '确认成功');
    }
    async requireOperableInstance(id, role) {
        const instance = await this.prisma.workflowInstance.findUnique({
            where: {
                id
            },
            include: {
                applicant: true
            }
        });
        if (!instance) {
            throw new app_exception_1.AppException(1004, '流程不存在', common_1.HttpStatus.NOT_FOUND);
        }
        if (instance.currentApproverRole !== role) {
            throw new app_exception_1.AppException(1003, '无权限访问', common_1.HttpStatus.FORBIDDEN);
        }
        if (!['pending', 'in_review', 'pending_security_confirm'].includes(instance.status)) {
            throw new app_exception_1.AppException(1005, '业务状态不允许当前操作', common_1.HttpStatus.BAD_REQUEST);
        }
        return instance;
    }
    getApprovalTransition(templateId, amount, operatorName) {
        if (templateId === 'wf1') {
            return {
                status: 'approved',
                currentNode: '流程结束',
                currentApproverRole: 'approver',
                latestComment: `${operatorName} 已通过，流程已结束。`
            };
        }
        if (templateId === 'wf2') {
            if (amount > 5000) {
                return {
                    status: 'pending_security_confirm',
                    currentNode: '等待数字盾二次确认',
                    currentApproverRole: 'systemAdmin',
                    latestComment: `${operatorName} 已通过，待系统管理员完成二次确认。`
                };
            }
            return {
                status: 'in_review',
                currentNode: '等待系统管理员确认',
                currentApproverRole: 'systemAdmin',
                latestComment: `${operatorName} 已通过，流转至系统管理员。`
            };
        }
        if (templateId === 'wf3') {
            if (amount > 10000) {
                return {
                    status: 'pending_security_confirm',
                    currentNode: '等待数字盾二次确认',
                    currentApproverRole: 'systemAdmin',
                    latestComment: `${operatorName} 已通过，金额较高，等待二次确认。`
                };
            }
            return {
                status: 'in_review',
                currentNode: '等待系统管理员确认',
                currentApproverRole: 'systemAdmin',
                latestComment: `${operatorName} 已通过，流转至系统管理员。`
            };
        }
        return {
            status: 'in_review',
            currentNode: '等待系统管理员确认',
            currentApproverRole: 'systemAdmin',
            latestComment: `${operatorName} 已通过，流转至系统管理员。`
        };
    }
    requiresSecurityConfirm(templateId, amount) {
        return (templateId === 'wf2' && amount > 5000) || (templateId === 'wf3' && amount > 10000);
    }
    getRiskReason(templateId, amount) {
        if (templateId === 'wf2' && amount > 5000) {
            return '报销金额超过 5000 元，需进行二次确认。';
        }
        if (templateId === 'wf3' && amount > 10000) {
            return '采购金额超过 10000 元，需进行二次确认。';
        }
        return '';
    }
    buildFormSummary(templateId, body, amount) {
        if (templateId === 'wf1') {
            return `${body.extraInput || '请假'}申请，原因：${body.reasonInput || '待补充'}。`;
        }
        if (templateId === 'wf2') {
            return `${body.extraInput || '报销'}，金额 ${amount} 元，需补充 ${body.attachmentInput || '相关材料'}。`;
        }
        if (templateId === 'wf3') {
            return `${body.extraInput || '采购申请'}，预算 ${amount} 元，用途：${body.reasonInput || '待补充'}。`;
        }
        return `${body.extraInput || '权限申请'}，业务场景：${body.reasonInput || '待补充'}。`;
    }
    buildFormDetail(templateId, body, amount) {
        if (templateId === 'wf1') {
            return [
                `请假类型：${body.extraInput || ''}`,
                `请假日期：${body.dateInput || ''}`,
                `请假原因：${body.reasonInput || ''}`
            ];
        }
        if (templateId === 'wf2') {
            return [
                `费用类型：${body.extraInput || ''}`,
                `报销金额：${amount} 元`,
                `事由：${body.reasonInput || ''}`,
                `附件：${body.attachmentInput || ''}`
            ];
        }
        if (templateId === 'wf3') {
            return [
                `采购物品：${body.extraInput || ''}`,
                `预算金额：${amount} 元`,
                `用途：${body.reasonInput || ''}`,
                `期望到货：${body.dateInput || ''}`
            ];
        }
        return [
            `系统名称：${body.extraInput || ''}`,
            `申请标题：${body.title || ''}`,
            `业务场景：${body.reasonInput || ''}`,
            `附件：${body.attachmentInput || ''}`
        ];
    }
    statusLabel(status) {
        switch (status) {
            case 'pending':
                return '待审批';
            case 'in_review':
                return '审批中';
            case 'pending_security_confirm':
                return '待二次确认';
            case 'approved':
                return '已通过';
            case 'rejected':
                return '已驳回';
            default:
                return status;
        }
    }
    toTemplateResponse(item) {
        return {
            id: item.id,
            name: item.name,
            description: item.description,
            approverText: item.approverText,
            relatedKnowledgeIds: (0, helpers_1.parseJsonArray)(item.relatedKnowledgeIdsJson),
            riskLevel: item.riskLevel,
            riskHint: item.riskHint,
            defaultApproverRoles: (0, helpers_1.parseJsonArray)(item.defaultApproverRolesJson)
        };
    }
    toInstanceResponse(item) {
        return {
            id: item.id,
            templateId: item.templateId,
            title: item.title,
            applicantId: item.applicantId,
            applicantName: item.applicantName,
            status: item.status,
            currentNode: item.currentNode,
            currentApproverRole: item.currentApproverRole,
            createTime: item.createTime,
            latestComment: item.latestComment,
            relatedKnowledgeIds: (0, helpers_1.parseJsonArray)(item.relatedKnowledgeIdsJson),
            amount: item.amount,
            formSummary: item.formSummary,
            formDetail: (0, helpers_1.parseJsonArray)(item.formDetailJson),
            approvalRecords: item.approvalRecords,
            riskLevel: item.riskLevel,
            riskReason: item.riskReason,
            requiresSecurityConfirm: item.requiresSecurityConfirm,
            securityConfirmed: item.securityConfirmed
        };
    }
    async createNotification(title, content, targetRoles, targetType, targetId) {
        await this.prisma.notification.create({
            data: {
                id: `n${Date.now()}${Math.floor(Math.random() * 1000)}`,
                title,
                content,
                time: (0, helpers_1.formatRelativeTime)(),
                read: false,
                targetRolesJson: (0, helpers_1.toJson)(targetRoles),
                targetType,
                targetId
            }
        });
    }
};
WorkflowService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkflowService);
let WorkflowController = class WorkflowController {
    constructor(workflowService) {
        this.workflowService = workflowService;
    }
    async getTemplates() {
        return this.workflowService.getTemplates();
    }
    async getMyInstances(request) {
        return this.workflowService.getMyInstances(request.user.id);
    }
    async getTodoInstances(request) {
        return this.workflowService.getTodoInstances(request.user.role);
    }
    async getInstance(id) {
        return this.workflowService.getInstance(id);
    }
    async createInstance(request, body) {
        return this.workflowService.createInstance(request.user.id, request.user.name, body);
    }
    async approveInstance(request, id, body) {
        return this.workflowService.approveInstance(request.user, id, body.comment);
    }
    async rejectInstance(request, id, body) {
        return this.workflowService.rejectInstance(request.user, id, body.comment);
    }
    async securityConfirm(request, id, body) {
        return this.workflowService.securityConfirm(request.user, id, body.comment);
    }
};
__decorate([
    (0, common_1.Get)('templates'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getTemplates", null);
__decorate([
    (0, common_1.Get)('instances/my'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getMyInstances", null);
__decorate([
    (0, common_1.Get)('instances/todo'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getTodoInstances", null);
__decorate([
    (0, common_1.Get)('instances/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getInstance", null);
__decorate([
    (0, common_1.Post)('instances'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, CreateWorkflowDto]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "createInstance", null);
__decorate([
    (0, common_1.Post)('instances/:id/approve'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CommentDto]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "approveInstance", null);
__decorate([
    (0, common_1.Post)('instances/:id/reject'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CommentDto]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "rejectInstance", null);
__decorate([
    (0, common_1.Post)('instances/:id/security-confirm'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, CommentDto]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "securityConfirm", null);
WorkflowController = __decorate([
    (0, common_1.Controller)('workflow'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [WorkflowService])
], WorkflowController);
let WorkflowModule = class WorkflowModule {
};
exports.WorkflowModule = WorkflowModule;
exports.WorkflowModule = WorkflowModule = __decorate([
    (0, common_1.Module)({
        controllers: [WorkflowController],
        providers: [WorkflowService, auth_guard_1.AuthGuard, prisma_service_1.PrismaService]
    })
], WorkflowModule);
//# sourceMappingURL=workflow.module.js.map