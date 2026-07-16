import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { ok } from '../common/app-response';
import { AppException } from '../common/app-exception';
import { AuthGuard } from '../common/auth.guard';
import { parseJsonArray } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  account!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
  token?: string;
};

@Injectable()
class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(account: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        account
      }
    });

    if (!user) {
      throw new AppException(1002, '账号不存在或密码错误', HttpStatus.UNAUTHORIZED);
    }

    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      throw new AppException(1002, '账号不存在或密码错误', HttpStatus.UNAUTHORIZED);
    }

    const token = uuid();
    await this.prisma.session.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    return ok({
      token,
      user: await this.buildUserProfile(user.id)
    });
  }

  async me(userId: string) {
    return ok(await this.buildUserProfile(userId));
  }

  async logout(token: string) {
    await this.prisma.session.updateMany({
      where: {
        token,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });

    return ok(null, '退出成功');
  }

  private async buildUserProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      },
      include: {
        departmentEntity: true,
        manager: true
      }
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const todoCount = await this.prisma.workflowInstance.count({
      where: {
        currentApproverRole: user.role,
        status: {
          in: ['pending', 'in_review', 'pending_security_confirm']
        }
      }
    });

    return {
      id: user.id,
      name: user.name,
      account: user.account,
      department: user.department,
      departmentId: user.departmentId || '',
      departmentName: user.departmentEntity?.name || user.department,
      managerId: user.managerId || '',
      managerName: user.manager?.name || '',
      jobTitle: user.jobTitle,
      employmentStatus: user.employmentStatus,
      role: user.role,
      roleLabel: user.roleLabel,
      permissions: parseJsonArray(user.permissionsJson),
      favoriteKnowledgeIds: parseJsonArray(user.favoriteKnowledgeIdsJson),
      recentKnowledgeIds: parseJsonArray(user.recentKnowledgeIdsJson),
      todoCount
    };
  }
}

@Controller('auth')
class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.account, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!.id);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  async logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.token!);
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, PrismaService]
})
export class AuthModule {}
