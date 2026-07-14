"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const app_exception_1 = require("./common/app-exception");
const http_exception_filter_1 = require("./common/http-exception.filter");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: () => new app_exception_1.AppException(1001, '参数错误', common_1.HttpStatus.BAD_REQUEST)
    }));
    app.enableCors();
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('智协库后端接口')
        .setDescription('Mobile_software_development 课程项目后端接口')
        .setVersion('1.0.0')
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = Number(process.env.PORT || 3000);
    await app.listen(port);
}
void bootstrap();
//# sourceMappingURL=main.js.map