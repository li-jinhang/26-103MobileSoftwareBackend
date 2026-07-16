import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type OrganizationUser = Prisma.UserGetPayload<{
  include: { departmentEntity: true; manager: true };
}>;

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { departmentEntity: true, manager: true }
    });
  }

  findUsers<T extends Prisma.UserFindManyArgs>(args: T) {
    return this.prisma.user.findMany(args) as Prisma.PrismaPromise<Prisma.UserGetPayload<T>[]>;
  }

  findDepartment(id: string) {
    return this.prisma.department.findUnique({ where: { id } });
  }

  findDepartments<T extends Prisma.DepartmentFindManyArgs>(args: T) {
    return this.prisma.department.findMany(args) as Prisma.PrismaPromise<Prisma.DepartmentGetPayload<T>[]>;
  }

  async createDepartment(data: Prisma.DepartmentCreateInput) {
    return this.prisma.department.create({ data });
  }

  async updateDepartment(id: string, data: Prisma.DepartmentUpdateInput) {
    return this.prisma.department.update({ where: { id }, data });
  }

  async updateUserOrganization(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { departmentEntity: true, manager: true }
    });
  }

  createAuditLog(data: Prisma.AuditLogCreateInput) {
    return this.prisma.auditLog.create({ data });
  }
}
