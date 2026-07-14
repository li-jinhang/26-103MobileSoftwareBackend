import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { ok } from '../common/app-response';
import { AppException } from '../common/app-exception';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime, formatRelativeTime, parseJsonArray, toJson } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  templateId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  extraInput?: string;

  @IsOptional()
  @IsString()
  dateInput?: string;

  @IsOptional()
  @IsNumber()
  amountInput?: number;

  @IsOptional()
  @IsString()
  reasonInput?: string;

  @IsOptional()
  @IsString()
  attachmentInput?: string;
}

class CommentDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    name: string;
    role: string;
  };
};

type WorkflowTemplateRecord = {
  id: string;
  name: string;
  description: string;
  approverText: string;
  relatedKnowledgeIdsJson: string;
  riskLevel: string;
  riskHint: string;
  defaultApproverRolesJson: string;
};

@Injectable()
class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async getTemplates() {
    const templates = await this.prisma.workflowTemplate.findMany();
    return ok(templates.map((item: WorkflowTemplateRecord) => this.toTemplateResponse(item)));
  }

  async getMyInstances(userId: string) {
    const items = await this.prisma.workflowInstance.findMany({
      where: {
        applicantId: userId
      },
      include: {
        approvalRecords: true
      }
    });

    return ok(items.map((item: Parameters<WorkflowService['toInstanceResponse']>[0]) => this.toInstanceResponse(item)));
  }

  async getTodoInstances(role: string) {
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

    return ok(items.map((item: Parameters<WorkflowService['toInstanceResponse']>[0]) => this.toInstanceResponse(item)));
  }

  async getInstance(id: string) {
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
      throw new AppException(1004, '流程不存在', HttpStatus.NOT_FOUND);
    }

    return ok(this.toInstanceResponse(item));
  }

  async createInstance(userId: string, userName: string, body: CreateWorkflowDto) {
    const template = await this.prisma.workflowTemplate.findUnique({
      where: {
        id: body.templateId
      }
    });

    if (!template) {
      throw new AppException(1004, '流程模板不存在', HttpStatus.NOT_FOUND);
    }

    if (!body.title.trim()) {
      throw new AppException(1001, '参数错误', HttpStatus.BAD_REQUEST);
    }

    const amount = Number(body.amountInput ?? 0);
    if (Number.isNaN(amount)) {
      throw new AppException(1001, '金额格式错误', HttpStatus.BAD_REQUEST);
    }

    const defaultApproverRoles = parseJsonArray<string>(template.defaultApproverRolesJson);
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
        createTime: formatDateTime(now),
        latestComment: '已从移动端发起流程。',
        relatedKnowledgeIdsJson: template.relatedKnowledgeIdsJson,
        amount,
        formSummary,
        formDetailJson: toJson(formDetail),
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
              time: formatDateTime(now)
            }
          ]
        }
      },
      include: {
        approvalRecords: true
      }
    });

    await this.createNotification(
      `${template.name}待处理`,
      `${userName}提交了“${created.title}”，请尽快审批。`,
      ['approver'],
      'workflow',
      created.id
    );

    return ok(
      {
        id: created.id,
        templateId: created.templateId,
        title: created.title,
        status: created.status,
        currentNode: created.currentNode,
        requiresSecurityConfirm: created.requiresSecurityConfirm
      },
      '提交流程成功'
    );
  }

  async approveInstance(user: AuthenticatedRequest['user'], id: string, comment?: string) {
    const instance = await this.requireOperableInstance(id, user!.role);

    if (instance.status === 'pending_security_confirm') {
      throw new AppException(1005, '当前流程需走二次安全确认', HttpStatus.BAD_REQUEST);
    }

    const next = this.getApprovalTransition(instance.templateId, instance.amount, user!.name);
    const latestComment = comment?.trim()
      ? `${user!.name}：${comment.trim()}`
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
              operatorRole: user!.role,
              operatorName: user!.name,
              decision: 'approved',
              comment: comment?.trim() || '审批通过',
              time: formatDateTime()
            }
          ]
        }
      }
    });

    if (next.status === 'in_review' || next.status === 'pending_security_confirm') {
      await this.createNotification(
        '流程待处理',
        `“${instance.title}”已流转至下一节点，请尽快处理。`,
        [next.currentApproverRole],
        'workflow',
        instance.id
      );
    }

    await this.createNotification(
      '流程状态更新',
      `你的流程“${instance.title}”状态已更新为${this.statusLabel(next.status)}。`,
      [instance.applicant.role],
      'workflow',
      instance.id
    );

    return ok(
      {
        id: updated.id,
        status: updated.status,
        currentNode: updated.currentNode,
        latestComment: updated.latestComment
      },
      '审批成功'
    );
  }

  async rejectInstance(user: AuthenticatedRequest['user'], id: string, comment?: string) {
    const instance = await this.requireOperableInstance(id, user!.role);

    const rejectComment = comment?.trim() || '流程已驳回';
    const updated = await this.prisma.workflowInstance.update({
      where: {
        id
      },
      data: {
        status: 'rejected',
        currentNode: '流程已驳回',
        latestComment: `${user!.name}：${rejectComment}`,
        approvalRecords: {
          create: [
            {
              id: `ar${Date.now()}`,
              nodeName: instance.currentNode,
              operatorRole: user!.role,
              operatorName: user!.name,
              decision: 'rejected',
              comment: rejectComment,
              time: formatDateTime()
            }
          ]
        }
      }
    });

    await this.createNotification(
      '流程被驳回',
      `你的流程“${instance.title}”已被驳回，请查看原因并重新提交。`,
      [instance.applicant.role],
      'workflow',
      instance.id
    );

    return ok(
      {
        id: updated.id,
        status: updated.status,
        currentNode: updated.currentNode,
        latestComment: updated.latestComment
      },
      '驳回成功'
    );
  }

  async securityConfirm(user: AuthenticatedRequest['user'], id: string, comment?: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: {
        id
      },
      include: {
        applicant: true
      }
    });

    if (!instance) {
      throw new AppException(1004, '流程不存在', HttpStatus.NOT_FOUND);
    }

    if (user!.role !== 'systemAdmin') {
      throw new AppException(1003, '无权限访问', HttpStatus.FORBIDDEN);
    }

    if (instance.status !== 'pending_security_confirm') {
      throw new AppException(1005, '业务状态不允许当前操作', HttpStatus.BAD_REQUEST);
    }

    const latestComment = comment?.trim()
      ? `${user!.name}：${comment.trim()}`
      : `${user!.name} 已完成二次确认。`;

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
              operatorRole: user!.role,
              operatorName: user!.name,
              decision: 'security_confirmed',
              comment: comment?.trim() || '已完成二次确认。',
              time: formatDateTime()
            }
          ]
        }
      }
    });

    await this.createNotification(
      '流程已完成',
      `你的流程“${instance.title}”已完成二次确认并通过。`,
      [instance.applicant.role],
      'workflow',
      instance.id
    );

    return ok(
      {
        id: updated.id,
        status: updated.status,
        currentNode: updated.currentNode,
        securityConfirmed: updated.securityConfirmed,
        latestComment: updated.latestComment
      },
      '确认成功'
    );
  }

  private async requireOperableInstance(id: string, role: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: {
        id
      },
      include: {
        applicant: true
      }
    });

    if (!instance) {
      throw new AppException(1004, '流程不存在', HttpStatus.NOT_FOUND);
    }

    if (instance.currentApproverRole !== role) {
      throw new AppException(1003, '无权限访问', HttpStatus.FORBIDDEN);
    }

    if (!['pending', 'in_review', 'pending_security_confirm'].includes(instance.status)) {
      throw new AppException(1005, '业务状态不允许当前操作', HttpStatus.BAD_REQUEST);
    }

    return instance;
  }

  private getApprovalTransition(templateId: string, amount: number, operatorName: string) {
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

  private requiresSecurityConfirm(templateId: string, amount: number) {
    return (templateId === 'wf2' && amount > 5000) || (templateId === 'wf3' && amount > 10000);
  }

  private getRiskReason(templateId: string, amount: number) {
    if (templateId === 'wf2' && amount > 5000) {
      return '报销金额超过 5000 元，需进行二次确认。';
    }

    if (templateId === 'wf3' && amount > 10000) {
      return '采购金额超过 10000 元，需进行二次确认。';
    }

    return '';
  }

  private buildFormSummary(templateId: string, body: CreateWorkflowDto, amount: number) {
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

  private buildFormDetail(templateId: string, body: CreateWorkflowDto, amount: number) {
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

  private statusLabel(status: string) {
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

  private toTemplateResponse(item: WorkflowTemplateRecord) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      approverText: item.approverText,
      relatedKnowledgeIds: parseJsonArray(item.relatedKnowledgeIdsJson),
      riskLevel: item.riskLevel,
      riskHint: item.riskHint,
      defaultApproverRoles: parseJsonArray(item.defaultApproverRolesJson)
    };
  }

  private toInstanceResponse(item: {
    id: string;
    templateId: string;
    title: string;
    applicantId: string;
    applicantName: string;
    status: string;
    currentNode: string;
    currentApproverRole: string;
    createTime: string;
    latestComment: string;
    relatedKnowledgeIdsJson: string;
    amount: number;
    formSummary: string;
    formDetailJson: string;
    approvalRecords: Array<{
      id: string;
      nodeName: string;
      operatorRole: string;
      operatorName: string;
      decision: string;
      comment: string;
      time: string;
    }>;
    riskLevel: string;
    riskReason: string;
    requiresSecurityConfirm: boolean;
    securityConfirmed: boolean;
  }) {
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
      relatedKnowledgeIds: parseJsonArray(item.relatedKnowledgeIdsJson),
      amount: item.amount,
      formSummary: item.formSummary,
      formDetail: parseJsonArray(item.formDetailJson),
      approvalRecords: item.approvalRecords,
      riskLevel: item.riskLevel,
      riskReason: item.riskReason,
      requiresSecurityConfirm: item.requiresSecurityConfirm,
      securityConfirmed: item.securityConfirmed
    };
  }

  private async createNotification(
    title: string,
    content: string,
    targetRoles: string[],
    targetType: string,
    targetId: string
  ) {
    await this.prisma.notification.create({
      data: {
        id: `n${Date.now()}${Math.floor(Math.random() * 1000)}`,
        title,
        content,
        time: formatRelativeTime(),
        read: false,
        targetRolesJson: toJson(targetRoles),
        targetType,
        targetId
      }
    });
  }
}

@Controller('workflow')
@UseGuards(AuthGuard)
class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Get('templates')
  async getTemplates() {
    return this.workflowService.getTemplates();
  }

  @Get('instances/my')
  async getMyInstances(@Req() request: AuthenticatedRequest) {
    return this.workflowService.getMyInstances(request.user!.id);
  }

  @Get('instances/todo')
  async getTodoInstances(@Req() request: AuthenticatedRequest) {
    return this.workflowService.getTodoInstances(request.user!.role);
  }

  @Get('instances/:id')
  async getInstance(@Param('id') id: string) {
    return this.workflowService.getInstance(id);
  }

  @Post('instances')
  async createInstance(@Req() request: AuthenticatedRequest, @Body() body: CreateWorkflowDto) {
    return this.workflowService.createInstance(request.user!.id, request.user!.name, body);
  }

  @Post('instances/:id/approve')
  async approveInstance(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CommentDto
  ) {
    return this.workflowService.approveInstance(request.user, id, body.comment);
  }

  @Post('instances/:id/reject')
  async rejectInstance(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CommentDto
  ) {
    return this.workflowService.rejectInstance(request.user, id, body.comment);
  }

  @Post('instances/:id/security-confirm')
  async securityConfirm(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CommentDto
  ) {
    return this.workflowService.securityConfirm(request.user, id, body.comment);
  }
}

@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService, AuthGuard, PrismaService]
})
export class WorkflowModule {}
