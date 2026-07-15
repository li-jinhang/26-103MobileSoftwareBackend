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
    MailModule
  ],
  providers: [PrismaService]
})
export class AppModule {}
