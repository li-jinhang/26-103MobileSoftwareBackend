import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'code' in exceptionResponse) {
        response.status(exception.getStatus()).json(exceptionResponse);
        return;
      }

      response.status(exception.getStatus()).json({
        code: this.mapCode(exception.getStatus()),
        message: this.extractMessage(exceptionResponse),
        data: null
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 1007,
      message: '服务器内部错误',
      data: null
    });
  }

  private mapCode(status: number): number {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 1001;
      case HttpStatus.UNAUTHORIZED:
        return 1002;
      case HttpStatus.FORBIDDEN:
        return 1003;
      case HttpStatus.NOT_FOUND:
        return 1004;
      default:
        return 1007;
    }
  }

  private extractMessage(exceptionResponse: string | object): string {
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
      const message = (exceptionResponse as { message: string | string[] }).message;
      return Array.isArray(message) ? message.join(', ') : message;
    }

    return '请求失败';
  }
}
