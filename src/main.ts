import 'reflect-metadata';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppException } from './common/app-exception';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: () => new AppException(1001, '参数错误', HttpStatus.BAD_REQUEST)
    })
  );
  app.enableCors();
  app.use(json({ limit: '10mb' }));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('智协库后端接口')
    .setDescription('Mobile_software_development 课程项目后端接口')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT || 26102);
  await app.listen(port);
}

void bootstrap();
