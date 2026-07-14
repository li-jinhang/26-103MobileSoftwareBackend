import {
  Body,
  Controller,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Request } from 'express';
import { ok } from '../common/app-response';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime, toJson } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class AskDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
};

@Injectable()
class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async ask(userId: string, question: string) {
    const keyword = question.trim();
    let reply: {
      answer: string;
      relatedKnowledgeIds: string[];
      recommendedWorkflowId: string;
    };

    if (keyword.includes('报销') || keyword.includes('打车') || keyword.includes('发票')) {
      reply = {
        answer: '根据《差旅报销制度》，报销需上传发票、行程截图和事由说明。你可以直接发起“报销申请”。',
        relatedKnowledgeIds: ['k2'],
        recommendedWorkflowId: 'wf2'
      };
    } else if (keyword.includes('请假') || keyword.includes('病假') || keyword.includes('年假')) {
      reply = {
        answer: '请假前建议先查看《请假制度说明》，确认请假类型和材料要求，然后发起“请假申请”。',
        relatedKnowledgeIds: ['k1'],
        recommendedWorkflowId: 'wf1'
      };
    } else if (keyword.includes('权限') || keyword.includes('账号') || keyword.includes('系统')) {
      reply = {
        answer: '系统权限开通需要说明业务场景、系统名称和期限范围，建议先阅读《系统权限申请规范》并发起“权限申请”。',
        relatedKnowledgeIds: ['k4'],
        recommendedWorkflowId: 'wf4'
      };
    } else if (keyword.includes('采购') || keyword.includes('预算') || keyword.includes('合同')) {
      reply = {
        answer: '采购流程需补充用途、预算和期望到货时间，可参考《采购申请规范》后发起“采购申请”。',
        relatedKnowledgeIds: ['k3'],
        recommendedWorkflowId: 'wf3'
      };
    } else {
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
        relatedKnowledgeIdsJson: toJson(reply.relatedKnowledgeIds),
        recommendedWorkflowId: reply.recommendedWorkflowId,
        time: formatDateTime()
      }
    });

    return ok(reply);
  }
}

@Controller('assistant')
@UseGuards(AuthGuard)
class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('ask')
  async ask(@Req() request: AuthenticatedRequest, @Body() body: AskDto) {
    return this.assistantService.ask(request.user!.id, body.question);
  }
}

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, AuthGuard, PrismaService]
})
export class AssistantModule {}
