import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from './app-exception';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    name: string;
    role: string;
  };
  token?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppException(1002, '未登录或 Token 无效', HttpStatus.UNAUTHORIZED);
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppException(1002, '未登录或 Token 无效', HttpStatus.UNAUTHORIZED);
    }

    const session = await this.prisma.session.findFirst({
      where: {
        token,
        revokedAt: null,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    if (!session) {
      throw new AppException(1002, '未登录或 Token 无效', HttpStatus.UNAUTHORIZED);
    }

    request.token = token;
    request.user = {
      id: session.user.id,
      name: session.user.name,
      role: session.user.role
    };

    return true;
  }
}
