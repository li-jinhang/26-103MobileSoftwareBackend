import {
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
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { Request } from 'express';
import { ok } from '../common/app-response';
import { AppException } from '../common/app-exception';
import { AuthGuard } from '../common/auth.guard';
import { parseJsonArray } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class NotificationQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

type AuthenticatedRequest = Request & {
  user?: {
    role: string;
  };
};

@Injectable()
class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(role: string, unreadOnly?: boolean) {
    const notifications = await this.prisma.notification.findMany({
      where: unreadOnly
        ? {
            read: false
          }
        : undefined
    });

    return ok(
      notifications
        .filter((item: { targetRolesJson: string }) => parseJsonArray<string>(item.targetRolesJson).includes(role))
        .map((item: {
          id: string;
          title: string;
          content: string;
          time: string;
          read: boolean;
          targetRolesJson: string;
          targetType: string;
          targetId: string;
        }) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          time: item.time,
          read: item.read,
          targetRoles: parseJsonArray(item.targetRolesJson),
          targetType: item.targetType,
          targetId: item.targetId
        }))
    );
  }

  async read(role: string, id: string) {
    const notification = await this.prisma.notification.findUnique({
      where: {
        id
      }
    });

    if (!notification) {
      throw new AppException(1004, '消息不存在', HttpStatus.NOT_FOUND);
    }

    if (!parseJsonArray<string>(notification.targetRolesJson).includes(role)) {
      throw new AppException(1003, '无权限访问', HttpStatus.FORBIDDEN);
    }

    const updated = await this.prisma.notification.update({
      where: {
        id
      },
      data: {
        read: true
      }
    });

    return ok(
      {
        id: updated.id,
        read: updated.read
      },
      '标记成功'
    );
  }
}

@Controller('notifications')
@UseGuards(AuthGuard)
class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: NotificationQueryDto) {
    return this.notificationsService.list(request.user!.role, query.unreadOnly);
  }

  @Post(':id/read')
  async read(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.notificationsService.read(request.user!.role, id);
  }
}

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, AuthGuard, PrismaService]
})
export class NotificationsModule {}
