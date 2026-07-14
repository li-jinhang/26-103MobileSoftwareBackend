"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const response = host.switchToHttp().getResponse();
        if (exception instanceof common_1.HttpException) {
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
        response.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({
            code: 1007,
            message: '服务器内部错误',
            data: null
        });
    }
    mapCode(status) {
        switch (status) {
            case common_1.HttpStatus.BAD_REQUEST:
                return 1001;
            case common_1.HttpStatus.UNAUTHORIZED:
                return 1002;
            case common_1.HttpStatus.FORBIDDEN:
                return 1003;
            case common_1.HttpStatus.NOT_FOUND:
                return 1004;
            default:
                return 1007;
        }
    }
    extractMessage(exceptionResponse) {
        if (typeof exceptionResponse === 'string') {
            return exceptionResponse;
        }
        if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
            const message = exceptionResponse.message;
            return Array.isArray(message) ? message.join(', ') : message;
        }
        return '请求失败';
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map