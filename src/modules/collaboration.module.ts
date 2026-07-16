import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { AuthGuard } from '../common/auth.guard';
import { AppException } from '../common/app-exception';
import { formatDateTime, parseJsonArray, toJson } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedRequest = Request & { user?: { id: string; name: string; role: string } };

class SummaryQueryDto {
  @IsOptional()
  @IsIn(['all', 'action', 'waiting'])
  focus: 'all' | 'action' | 'waiting' = 'all';
}

class CreateMeetingDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsOptional()
  @IsString()
  location = '';

  @IsOptional()
  @IsString()
  description = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participantIds: string[] = [];
}

class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  assigneeId!: string;

  @IsOptional()
  @IsString()
  description = '';

  @IsOptional()
  @IsString()
  dueTime = '';
}

class ReplyTaskDto {
  @IsString()
  @IsNotEmpty()
  reply!: string;
}

class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description = '';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds: string[] = [];
}

@Injectable()
class CollaborationService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: NonNullable<AuthenticatedRequest['user']>, focus: SummaryQueryDto['focus']) {
    const [actionTasks, waitingTasks, meetings, groups, employee] = await Promise.all([
      this.prisma.collaborationTask.findMany({
        where: { assigneeId: user.id, status: 'pending' },
        orderBy: { createTime: 'desc' }
      }),
      this.prisma.collaborationTask.findMany({
        where: { initiatorId: user.id, status: 'pending' },
        orderBy: { createTime: 'desc' }
      }),
      this.prisma.collaborationMeeting.findMany({
        where: { OR: [{ organizerId: user.id }, { participantIdsJson: { contains: user.id } }] },
        orderBy: { startTime: 'asc' }
      }),
      this.prisma.collaborationGroup.findMany({ orderBy: { createTime: 'desc' } }),
      this.prisma.user.findUnique({
        where: { id: user.id },
        include: { manager: true, directReports: { where: { employmentStatus: 'active' }, orderBy: { name: 'asc' } } }
      })
    ]);
    const groupItems = groups.filter((group) =>
      group.ownerId === user.id || parseJsonArray<string>(group.memberIdsJson).includes(user.id)
    ).map((group) => this.groupResponse(group));
    const chainItems = employee ? [
      ...(employee.manager ? [{ type: 'manager', id: employee.manager.id, name: employee.manager.name, jobTitle: employee.manager.jobTitle }] : []),
      ...employee.directReports.map((item) => ({ type: 'directReport', id: item.id, name: item.name, jobTitle: item.jobTitle }))
    ] : [];

    return {
      focus,
      actionCount: actionTasks.length,
      waitingCount: waitingTasks.length,
      meetingCount: meetings.length,
      groupCount: groupItems.length,
      meetingItems: meetings.map((item) => this.meetingResponse(item)),
      taskItems: (focus === 'waiting' ? waitingTasks : actionTasks).map((item) => this.taskResponse(item)),
      groupItems,
      chainItems
    };
  }

  async meetings(userId: string) {
    const items = await this.prisma.collaborationMeeting.findMany({ orderBy: { startTime: 'asc' } });
    return items.filter((item) => item.organizerId === userId || parseJsonArray<string>(item.participantIdsJson).includes(userId))
      .map((item) => this.meetingResponse(item));
  }

  async createMeeting(user: NonNullable<AuthenticatedRequest['user']>, body: CreateMeetingDto) {
    await this.requireActiveUsers(body.participantIds);
    const item = await this.prisma.collaborationMeeting.create({
      data: {
        id: `meeting-${Date.now()}`,
        title: body.title.trim(),
        startTime: body.startTime.trim(),
        location: body.location.trim(),
        description: body.description.trim(),
        organizerId: user.id,
        organizerName: user.name,
        participantIdsJson: toJson(this.uniqueIds(body.participantIds, user.id)),
        status: 'scheduled'
      }
    });
    return this.meetingResponse(item);
  }

  async tasks(userId: string) {
    const items = await this.prisma.collaborationTask.findMany({
      where: { OR: [{ initiatorId: userId }, { assigneeId: userId }] },
      orderBy: { createTime: 'desc' }
    });
    return items.map((item) => this.taskResponse(item));
  }

  async createTask(user: NonNullable<AuthenticatedRequest['user']>, body: CreateTaskDto) {
    const assignee = await this.requireActiveUser(body.assigneeId);
    const now = formatDateTime();
    const item = await this.prisma.collaborationTask.create({
      data: {
        id: `task-${Date.now()}`,
        title: body.title.trim(),
        description: body.description.trim(),
        initiatorId: user.id,
        initiatorName: user.name,
        assigneeId: assignee.id,
        assigneeName: assignee.name,
        status: 'pending',
        dueTime: body.dueTime.trim(),
        createTime: now
      }
    });
    if (assignee.id !== user.id) {
      await this.createMessage(user, assignee.id, `工作对接：${item.title}`, item.description || '请查看并回复工作事项。', 'task', item.id);
    }
    return this.taskResponse(item);
  }

  async replyTask(user: NonNullable<AuthenticatedRequest['user']>, id: string, body: ReplyTaskDto) {
    const task = await this.prisma.collaborationTask.findUnique({ where: { id } });
    if (!task) this.notFound('任务不存在');
    if (task!.assigneeId !== user.id) this.forbidden('仅任务接收人可以回复');
    const replyTime = formatDateTime();
    const updated = await this.prisma.collaborationTask.update({
      where: { id },
      data: { reply: body.reply.trim(), replyTime, status: 'replied' }
    });
    if (updated.initiatorId !== user.id) {
      await this.createMessage(user, updated.initiatorId, `任务已回复：${updated.title}`, updated.reply, 'taskReply', updated.id);
    }
    return this.taskResponse(updated);
  }

  async groups(userId: string) {
    const items = await this.prisma.collaborationGroup.findMany({ orderBy: { createTime: 'desc' } });
    return items.filter((item) => item.ownerId === userId || parseJsonArray<string>(item.memberIdsJson).includes(userId))
      .map((item) => this.groupResponse(item));
  }

  async createGroup(user: NonNullable<AuthenticatedRequest['user']>, body: CreateGroupDto) {
    const memberIds = this.uniqueIds(body.memberIds, user.id);
    await this.requireActiveUsers(memberIds);
    const item = await this.prisma.collaborationGroup.create({
      data: {
        id: `group-${Date.now()}`,
        name: body.name.trim(),
        description: body.description.trim(),
        ownerId: user.id,
        ownerName: user.name,
        memberIdsJson: toJson(memberIds),
        createTime: formatDateTime()
      }
    });
    return this.groupResponse(item);
  }

  async chains(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { manager: true, directReports: { where: { employmentStatus: 'active' }, orderBy: { name: 'asc' } } }
    });
    if (!user) this.notFound('用户不存在');
    return {
      employee: { id: user!.id, name: user!.name, jobTitle: user!.jobTitle },
      manager: user!.manager ? { id: user!.manager.id, name: user!.manager.name, jobTitle: user!.manager.jobTitle } : null,
      directReports: user!.directReports.map((item) => ({ id: item.id, name: item.name, jobTitle: item.jobTitle }))
    };
  }

  private async createMessage(sender: NonNullable<AuthenticatedRequest['user']>, recipientId: string, title: string, content: string, type: string, relatedId: string) {
    await this.prisma.collaborationMessage.create({
      data: { id: `message-${Date.now()}-${Math.floor(Math.random() * 1000)}`, senderId: sender.id, senderName: sender.name, recipientId, title, content, type, relatedId, createTime: formatDateTime() }
    });
  }

  private async requireActiveUsers(ids: string[]) {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
    if (unique.length === 0) return;
    const users = await this.prisma.user.findMany({ where: { id: { in: unique }, employmentStatus: 'active' }, select: { id: true } });
    if (users.length !== unique.length) this.notFound('参与人不存在或已停用');
  }

  private async requireActiveUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id: id.trim() } });
    if (!user || user.employmentStatus !== 'active') this.notFound('接收人不存在或已停用');
    return user!;
  }

  private uniqueIds(ids: string[], currentUserId: string) {
    return Array.from(new Set([...ids.map((id) => id.trim()).filter(Boolean), currentUserId]));
  }

  private meetingResponse(item: { id: string; title: string; startTime: string; location: string; description: string; organizerId: string; organizerName: string; participantIdsJson: string; status: string }) {
    return { ...item, participantIds: parseJsonArray<string>(item.participantIdsJson), participantIdsJson: undefined };
  }

  private taskResponse(item: { id: string; title: string; description: string; initiatorId: string; initiatorName: string; assigneeId: string; assigneeName: string; status: string; reply: string; replyTime: string; dueTime: string; createTime: string }) {
    return item;
  }

  private groupResponse(item: { id: string; name: string; description: string; ownerId: string; ownerName: string; memberIdsJson: string; createTime: string }) {
    return { ...item, memberIds: parseJsonArray<string>(item.memberIdsJson), memberIdsJson: undefined };
  }

  private forbidden(message: string): never { throw new AppException(1003, message, HttpStatus.FORBIDDEN); }
  private notFound(message: string): never { throw new AppException(1004, message, HttpStatus.NOT_FOUND); }
}

@Injectable()
class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async feed(userId: string) {
    const messages = await this.prisma.collaborationMessage.findMany({ where: { recipientId: userId }, orderBy: { createTime: 'desc' } });
    return messages;
  }

  async markRead(userId: string, id: string) {
    const message = await this.prisma.collaborationMessage.findUnique({ where: { id } });
    if (!message) throw new AppException(1004, '消息不存在', HttpStatus.NOT_FOUND);
    if (message.recipientId !== userId) throw new AppException(1003, '无权操作该消息', HttpStatus.FORBIDDEN);
    return this.prisma.collaborationMessage.update({ where: { id }, data: { read: true } });
  }
}

@Controller('collaboration')
@UseGuards(AuthGuard)
class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  @Get('summary') summary(@Req() request: AuthenticatedRequest, @Query() query: SummaryQueryDto) { return this.collaborationService.summary(request.user!, query.focus); }
  @Get('meetings') meetings(@Req() request: AuthenticatedRequest) { return this.collaborationService.meetings(request.user!.id); }
  @Post('meetings') createMeeting(@Req() request: AuthenticatedRequest, @Body() body: CreateMeetingDto) { return this.collaborationService.createMeeting(request.user!, body); }
  @Get('tasks') tasks(@Req() request: AuthenticatedRequest) { return this.collaborationService.tasks(request.user!.id); }
  @Post('tasks') createTask(@Req() request: AuthenticatedRequest, @Body() body: CreateTaskDto) { return this.collaborationService.createTask(request.user!, body); }
  @Post('tasks/:id/reply') replyTask(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: ReplyTaskDto) { return this.collaborationService.replyTask(request.user!, id, body); }
  @Get('groups') groups(@Req() request: AuthenticatedRequest) { return this.collaborationService.groups(request.user!.id); }
  @Post('groups') createGroup(@Req() request: AuthenticatedRequest, @Body() body: CreateGroupDto) { return this.collaborationService.createGroup(request.user!, body); }
  @Get('chains') chains(@Req() request: AuthenticatedRequest) { return this.collaborationService.chains(request.user!.id); }
}

@Controller('messages')
@UseGuards(AuthGuard)
class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get('feed') feed(@Req() request: AuthenticatedRequest) { return this.messagesService.feed(request.user!.id); }
  @Post(':id/read') markRead(@Req() request: AuthenticatedRequest, @Param('id') id: string) { return this.messagesService.markRead(request.user!.id, id); }
}

@Module({
  controllers: [CollaborationController, MessagesController],
  providers: [CollaborationService, MessagesService, AuthGuard, PrismaService]
})
export class CollaborationModule {}
