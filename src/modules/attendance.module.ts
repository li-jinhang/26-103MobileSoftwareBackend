import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Request } from 'express';
import { AppException } from '../common/app-exception';
import { ok } from '../common/app-response';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class AttendanceActionDto {
  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsOptional()
  @IsString()
  note?: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    name: string;
  };
};

type AttendanceRecordResponse = {
  id: string;
  userId: string;
  userName: string;
  type: string;
  time: string;
  location: string;
  note: string;
  status: string;
};

@Injectable()
class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string) {
    return ok(await this.buildTodaySummary(userId));
  }

  async myRecords(userId: string) {
    const records = await this.prisma.attendanceRecord.findMany({
      where: { userId },
      orderBy: { time: 'desc' }
    });
    return ok(records);
  }

  async checkIn(user: NonNullable<AuthenticatedRequest['user']>, body: AttendanceActionDto) {
    return this.createRecord(user, body, 'checkIn');
  }

  async checkOut(user: NonNullable<AuthenticatedRequest['user']>, body: AttendanceActionDto) {
    return this.createRecord(user, body, 'checkOut');
  }

  private async createRecord(
    user: NonNullable<AuthenticatedRequest['user']>,
    body: AttendanceActionDto,
    type: 'checkIn' | 'checkOut'
  ) {
    const now = new Date();
    const date = this.formatDate(now);
    const previous = await this.prisma.attendanceRecord.findFirst({
      where: {
        userId: user.id,
        type,
        time: { startsWith: date }
      }
    });

    if (previous) {
      throw new AppException(1005, type === 'checkIn' ? '今日已签到' : '今日已签退', HttpStatus.CONFLICT);
    }

    if (type === 'checkOut') {
      const checkIn = await this.prisma.attendanceRecord.findFirst({
        where: {
          userId: user.id,
          type: 'checkIn',
          time: { startsWith: date }
        }
      });
      if (!checkIn) {
        throw new AppException(1005, '请先完成签到', HttpStatus.BAD_REQUEST);
      }
    }

    await this.prisma.attendanceRecord.create({
      data: {
        id: `at${Date.now()}`,
        userId: user.id,
        userName: user.name,
        type,
        time: formatDateTime(now),
        location: body.location.trim(),
        note: body.note?.trim() ?? '',
        status: 'normal'
      }
    });

    return ok(await this.buildTodaySummary(user.id));
  }

  private async buildTodaySummary(userId: string) {
    const now = new Date();
    const date = this.formatDate(now);
    const todayRecords = await this.prisma.attendanceRecord.findMany({
      where: { userId, time: { startsWith: date } },
      orderBy: { time: 'desc' }
    });
    const recentRecords = await this.prisma.attendanceRecord.findMany({
      where: { userId },
      orderBy: { time: 'desc' },
      take: 10
    });
    const checkIn = todayRecords.find((record) => record.type === 'checkIn');
    const checkOut = todayRecords.find((record) => record.type === 'checkOut');

    return {
      date,
      checkedIn: Boolean(checkIn),
      checkedOut: Boolean(checkOut),
      checkInTime: checkIn ? this.timePart(checkIn.time) : '',
      checkOutTime: checkOut ? this.timePart(checkOut.time) : '',
      workDurationText: this.workDurationText(checkIn?.time, checkOut?.time, now),
      statusText: this.statusText(checkIn?.status, checkOut?.status),
      location: checkOut?.location ?? checkIn?.location ?? '深圳南山办公区',
      recentRecords: recentRecords as AttendanceRecordResponse[]
    };
  }

  private formatDate(date: Date): string {
    return formatDateTime(date).slice(0, 10);
  }

  private timePart(value: string): string {
    return value.slice(11, 16);
  }

  private workDurationText(checkInTime: string | undefined, checkOutTime: string | undefined, now: Date): string {
    if (!checkInTime) {
      return '尚未签到';
    }
    const start = new Date(`${checkInTime.replace(' ', 'T')}:00`);
    const end = checkOutTime ? new Date(`${checkOutTime.replace(' ', 'T')}:00`) : now;
    const totalMinutes = Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
    const prefix = checkOutTime ? '工作时长' : '已工作';
    return `${prefix} ${Math.floor(totalMinutes / 60)} 小时 ${totalMinutes % 60} 分`;
  }

  private statusText(checkInStatus?: string, checkOutStatus?: string): string {
    const status = [checkInStatus, checkOutStatus].find((item) => item && item !== 'normal') ?? checkOutStatus ?? checkInStatus;
    switch (status) {
      case 'late':
        return '今日迟到';
      case 'earlyLeave':
        return '今日早退';
      case 'offsite':
        return '今日异地出勤';
      case 'normal':
        return '今日正常出勤';
      default:
        return '尚未签到';
    }
  }
}

@Controller('attendance')
@UseGuards(AuthGuard)
class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  async today(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.today(request.user!.id);
  }

  @Get('records/my')
  async myRecords(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.myRecords(request.user!.id);
  }

  @Post('check-in')
  async checkIn(@Req() request: AuthenticatedRequest, @Body() body: AttendanceActionDto) {
    return this.attendanceService.checkIn(request.user!, body);
  }

  @Post('check-out')
  async checkOut(@Req() request: AuthenticatedRequest, @Body() body: AttendanceActionDto) {
    return this.attendanceService.checkOut(request.user!, body);
  }
}

@Module({
  controllers: [AttendanceController],
  providers: [AttendanceService, AuthGuard, PrismaService]
})
export class AttendanceModule {}
