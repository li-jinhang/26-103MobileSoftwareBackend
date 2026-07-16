import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { AuthModule } from './modules/auth.module';
import { KnowledgeModule } from './modules/knowledge.module';
import { WorkflowModule } from './modules/workflow.module';
import { NotificationsModule } from './modules/notifications.module';
import { AssistantModule } from './modules/assistant.module';
import { AttendanceModule } from './modules/attendance.module';
import { MailModule } from './modules/mail.module';
import { OcrModule } from './modules/ocr.module';
import { OrganizationModule } from './modules/organization.module';
import { CollaborationModule } from './modules/collaboration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    KnowledgeModule,
    WorkflowModule,
    NotificationsModule,
    AssistantModule,
    AttendanceModule,
    MailModule,
    OcrModule,
    OrganizationModule,
    CollaborationModule
  ],
  providers: [PrismaService]
})
export class AppModule {}
