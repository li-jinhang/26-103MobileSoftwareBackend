import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { ArrayNotEmpty, IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { AppException } from '../common/app-exception';
import { ok } from '../common/app-response';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime, formatRelativeTime, toJson } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class SendMailDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  receiverIds!: string[];

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  relatedWorkflowId?: string;

  @IsOptional()
  @IsString()
  relatedKnowledgeId?: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    name: string;
    role: string;
  };
};

@Injectable()
class MailService {
  constructor(private readonly prisma: PrismaService) {}

  async inbox(userId: string) {
    const entries = await this.prisma.mailRecipient.findMany({
      where: { userId },
      include: { mail: { include: { recipients: true } } },
      orderBy: { mail: { createTime: 'desc' } }
    });
    return ok(entries.map((entry) => this.toResponse(entry.mail, 'inbox', entry)));
  }

  async sent(userId: string) {
    const mails = await this.prisma.internalMail.findMany({
      where: { senderId: userId },
      include: { recipients: true },
      orderBy: { createTime: 'desc' }
    });
    return ok(mails.map((mail) => this.toResponse(mail, 'sent')));
  }

  async detail(userId: string, id: string) {
    const mail = await this.requireMail(id);
    if (mail.senderId === userId) {
      return ok(this.toResponse(mail, 'sent'));
    }

    const recipient = mail.recipients.find((item) => item.userId === userId);
    if (!recipient) {
      throw new AppException(1003, '无权访问该邮件', HttpStatus.FORBIDDEN);
    }
    return ok(this.toResponse(mail, 'inbox', recipient));
  }

  async send(user: NonNullable<AuthenticatedRequest['user']>, body: SendMailDto) {
    const receiverIds = Array.from(new Set(body.receiverIds.map((id) => id.trim()).filter(Boolean)));
    const recipients = await this.prisma.user.findMany({ where: { id: { in: receiverIds } } });
    if (recipients.length !== receiverIds.length) {
      throw new AppException(1004, '收件人不存在', HttpStatus.NOT_FOUND);
    }

    const now = new Date();
    const id = `mail${Date.now()}`;
    const subject = body.subject.trim();
    const content = body.content.trim();
    await this.prisma.internalMail.create({
      data: {
        id,
        subject,
        summary: this.summary(content),
        content,
        senderId: user.id,
        senderName: user.name,
        importance: 'normal',
        createTime: formatDateTime(now),
        relatedWorkflowId: body.relatedWorkflowId?.trim() ?? '',
        relatedKnowledgeId: body.relatedKnowledgeId?.trim() ?? '',
        recipients: {
          create: recipients.map((recipient, index) => ({
            id: `${id}-recipient-${index}`,
            userId: recipient.id,
            userName: recipient.name,
            read: false,
            readTime: ''
          }))
        }
      }
    });

    await this.prisma.notification.createMany({
      data: recipients.map((recipient, index) => ({
        id: `n${Date.now()}${index}`,
        title: '收到一封内部邮件',
        content: `${user.name} 发来“${subject}”，可直接进入邮件查看详情。`,
        time: formatRelativeTime(now),
        read: false,
        targetRolesJson: toJson([recipient.role]),
        targetType: 'mail',
        targetId: id,
        recipientUserId: recipient.id
      }))
    });

    return ok({ id }, '发送成功');
  }

  async markRead(userId: string, id: string) {
    await this.requireMail(id);
    const recipient = await this.prisma.mailRecipient.findUnique({ where: { mailId_userId: { mailId: id, userId } } });
    if (!recipient) {
      throw new AppException(1003, '无权操作该邮件', HttpStatus.FORBIDDEN);
    }
    await this.prisma.mailRecipient.update({
      where: { id: recipient.id },
      data: { read: true, readTime: formatDateTime() }
    });
    return ok({ id, read: true }, '标记成功');
  }

  async remove(userId: string, id: string) {
    const mail = await this.requireMail(id);
    if (mail.senderId === userId) {
      await this.prisma.internalMail.delete({ where: { id } });
    } else {
      const recipient = mail.recipients.find((item) => item.userId === userId);
      if (!recipient) {
        throw new AppException(1003, '无权操作该邮件', HttpStatus.FORBIDDEN);
      }
      await this.prisma.mailRecipient.delete({ where: { id: recipient.id } });
    }
    return ok({ id }, '删除成功');
  }

  private async requireMail(id: string) {
    const mail = await this.prisma.internalMail.findUnique({
      where: { id },
      include: { recipients: true }
    });
    if (!mail) {
      throw new AppException(1004, '邮件不存在', HttpStatus.NOT_FOUND);
    }
    return mail;
  }

  private toResponse(
    mail: Awaited<ReturnType<MailService['requireMail']>>,
    folder: 'inbox' | 'sent',
    recipient?: { userId: string; userName: string; read: boolean; readTime: string }
  ) {
    return {
      id: mail.id,
      subject: mail.subject,
      summary: mail.summary,
      content: mail.content,
      senderId: mail.senderId,
      senderName: mail.senderName,
      recipients: mail.recipients.map((item) => ({
        userId: item.userId,
        userName: item.userName,
        read: item.read,
        readTime: item.readTime
      })),
      folder,
      importance: mail.importance,
      createTime: mail.createTime,
      read: recipient?.read ?? true,
      relatedWorkflowId: mail.relatedWorkflowId,
      relatedKnowledgeId: mail.relatedKnowledgeId
    };
  }

  private summary(content: string): string {
    return content.replace(/\s+/g, ' ').slice(0, 80);
  }
}

@Controller('mail')
@UseGuards(AuthGuard)
class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('inbox')
  async inbox(@Req() request: AuthenticatedRequest) {
    return this.mailService.inbox(request.user!.id);
  }

  @Get('sent')
  async sent(@Req() request: AuthenticatedRequest) {
    return this.mailService.sent(request.user!.id);
  }

  @Post('send')
  async send(@Req() request: AuthenticatedRequest, @Body() body: SendMailDto) {
    return this.mailService.send(request.user!, body);
  }

  @Post(':id/read')
  async markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mailService.markRead(request.user!.id, id);
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mailService.remove(request.user!.id, id);
  }

  @Get(':id')
  async detail(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.mailService.detail(request.user!.id, id);
  }
}

@Module({
  controllers: [MailController],
  providers: [MailService, AuthGuard, PrismaService]
})
export class MailModule {}
