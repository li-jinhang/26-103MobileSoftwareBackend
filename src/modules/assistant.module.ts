import {
  Body,
  Controller,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { AppException } from '../common/app-exception';
import { ok } from '../common/app-response';
import {
  AssistantAnalysisResult,
  AssistantFormDraft,
  AssistantIntent,
  parseAssistantModelContent
} from '../common/assistant-result';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime, parseJsonArray, toJson } from '../common/helpers';
import { LlmMessage, requestLlmJson } from '../common/llm-client';
import { PrismaService } from '../prisma/prisma.service';

class AskDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}

class AnalyzeAssistantDto {
  @IsOptional()
  @IsString()
  text = '';

  @IsOptional()
  @IsString()
  imageBase64 = '';

  @IsOptional()
  @IsIn(['', 'image/jpeg', 'image/png'])
  imageMimeType = '';
}

type AuthenticatedRequest = Request & {
  user?: { id: string };
};

interface KnowledgeContext {
  id: string;
  title: string;
  summary: string;
  content: string;
  categoryName: string;
  tags: string[];
  relatedWorkflowIds: string[];
}

interface WorkflowContext {
  id: string;
  name: string;
  description: string;
  riskLevel: string;
  riskHint: string;
}

const INTENT_WORKFLOW: Record<AssistantIntent, string> = {
  knowledge_query: '',
  leave: 'wf1',
  reimbursement: 'wf2',
  purchase: 'wf3',
  permission: 'wf4',
  unknown: ''
};

function clearWorkflow(result: AssistantAnalysisResult): void {
  const emptyDraft: AssistantFormDraft = {
    title: '', extra: '', date: '', amount: '', reason: '', attachment: ''
  };
  result.recommendedWorkflowId = '';
  result.formDraft = emptyDraft;
  result.missingFields = [];
}

@Injectable()
class AssistantService {
  constructor(private readonly prisma: PrismaService) {}

  async analyze(userId: string, input: AnalyzeAssistantDto) {
    const text = input.text.trim();
    const imageBase64 = input.imageBase64.trim();
    const imageMimeType = input.imageMimeType.trim();
    if (text.length === 0 && imageBase64.length === 0) {
      throw new AppException(1001, '请输入问题或选择图片', HttpStatus.BAD_REQUEST);
    }
    if (imageBase64.length > 8_000_000) {
      throw new AppException(1001, '图片过大，请选择较小的图片', HttpStatus.PAYLOAD_TOO_LARGE);
    }
    if (imageBase64.length > 0 && !['image/jpeg', 'image/png'].includes(imageMimeType)) {
      throw new AppException(1001, '图片格式仅支持 JPEG 或 PNG', HttpStatus.BAD_REQUEST);
    }

    const [articles, templates] = await Promise.all([
      this.prisma.knowledgeArticle.findMany({
        where: { status: 'published' },
        orderBy: { updateTime: 'desc' }
      }),
      this.prisma.workflowTemplate.findMany({ orderBy: { id: 'asc' } })
    ]);
    const knowledgeContext: KnowledgeContext[] = articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      categoryName: article.categoryName,
      tags: parseJsonArray(article.tagsJson),
      relatedWorkflowIds: parseJsonArray(article.relatedWorkflowIdsJson)
    }));
    const workflowContext: WorkflowContext[] = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      riskLevel: template.riskLevel,
      riskHint: template.riskHint
    }));
    const systemPrompt = [
      '你是公司内部智能知识助手，同时具备图片理解能力。',
      '只能依据提供的知识和流程上下文回答，不得编造制度、知识ID或流程ID。',
      '只返回合法JSON，禁止Markdown和额外文字。',
      '必须返回 answer, recognizedText, intent, relatedKnowledgeIds, recommendedWorkflowId, confidence, formDraft, missingFields。',
      'intent只能是 knowledge_query, leave, reimbursement, purchase, permission, unknown。',
      'formDraft必须包含 title, extra, date, amount, reason, attachment 六个字符串字段。',
      '无法确认的字段使用空字符串并加入missingFields；不要假装已提交任何流程。',
      `当前时间：${formatDateTime()}，时区：Asia/Shanghai。`,
      `知识上下文：${JSON.stringify(knowledgeContext)}`,
      `流程上下文：${JSON.stringify(workflowContext)}`
    ].join('\n');
    const userContent: unknown = imageBase64.length > 0
      ? [
          {
            type: 'text',
            text: text.length > 0 ? text : '读取图片内容，并回答与公司知识或流程相关的问题。'
          },
          {
            type: 'image_url',
            image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
          }
        ]
      : text;
    const messages: LlmMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];
    const modelContent = await requestLlmJson(messages);
    const result = parseAssistantModelContent(
      modelContent,
      new Set(articles.map((article) => article.id)),
      new Set(templates.map((template) => template.id))
    );
    const requiredWorkflow = INTENT_WORKFLOW[result.intent];
    if (requiredWorkflow.length === 0 || result.recommendedWorkflowId !== requiredWorkflow) {
      clearWorkflow(result);
    }
    if (result.answer.length === 0) {
      throw new AppException(1007, '大模型未返回可用回答', HttpStatus.BAD_GATEWAY);
    }

    const question = text.length > 0
      ? text
      : `图片查询：${result.recognizedText.slice(0, 120) || '未提取到文字'}`;
    await this.prisma.assistantHistory.create({
      data: {
        id: `ah${Date.now()}`,
        userId,
        question,
        answer: result.answer,
        relatedKnowledgeIdsJson: toJson(result.relatedKnowledgeIds),
        recommendedWorkflowId: result.recommendedWorkflowId,
        time: formatDateTime()
      }
    });
    return ok(result);
  }
}

@Controller('assistant')
@UseGuards(AuthGuard)
class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Post('analyze')
  async analyze(@Req() request: AuthenticatedRequest, @Body() body: AnalyzeAssistantDto) {
    return this.assistantService.analyze(request.user!.id, body);
  }

  @Post('ask')
  async ask(@Req() request: AuthenticatedRequest, @Body() body: AskDto) {
    const input = new AnalyzeAssistantDto();
    input.text = body.question;
    return this.assistantService.analyze(request.user!.id, input);
  }
}

@Module({
  controllers: [AssistantController],
  providers: [AssistantService, AuthGuard, PrismaService]
})
export class AssistantModule {}
