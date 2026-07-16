import { Module } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationController } from './organization/organization.controller';
import { OrganizationRepository } from './organization/organization.repository';
import { OrganizationService } from './organization/organization.service';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository, AuthGuard, PrismaService]
})
export class OrganizationModule {}
