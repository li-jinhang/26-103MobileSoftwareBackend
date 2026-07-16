import { HttpStatus, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { AppException } from '../../common/app-exception';
import { formatDateTime } from '../../common/helpers';
import {
  CreateDepartmentDto,
  CreateUserDto,
  OrganizationUsersQueryDto,
  UpdateDepartmentDto,
  UpdateUserOrganizationDto
} from './organization.dto';
import { OrganizationRepository } from './organization.repository';
import { toDepartmentNode, toDirectoryItem } from './organization.mapper';

type Actor = { id: string; name: string; role: string };

@Injectable()
export class OrganizationService {
  constructor(private readonly repository: OrganizationRepository) {}

  async getMyOrganization(userId: string) {
    const employee = await this.requireUser(userId);
    const departmentId = employee.departmentId;
    const directReports = departmentId
      ? await this.repository.findUsers({
          where: { managerId: employee.id, employmentStatus: 'active' },
          include: { departmentEntity: true, manager: true },
          orderBy: [{ name: 'asc' }]
        })
      : [];
    const departmentMembers = departmentId
      ? await this.repository.findUsers({
          where: { departmentId, employmentStatus: 'active' },
          include: { departmentEntity: true, manager: true },
          orderBy: [{ name: 'asc' }]
        })
      : [];

    const manager = employee.managerId ? await this.repository.findUser(employee.managerId) : null;
    return {
      employee: toDirectoryItem(employee),
      manager: manager ? toDirectoryItem(manager) : null,
      directReports: directReports.map(toDirectoryItem),
      departmentMembers: departmentMembers.map(toDirectoryItem)
    };
  }

  async getDepartmentTree(actor: Actor) {
    const user = await this.requireUser(actor.id);
    const isAdmin = actor.role === 'systemAdmin';
    const departments = await this.repository.findDepartments({
      where: isAdmin ? { status: 'active' } : { id: user.departmentId || '', status: 'active' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
    });
    return this.buildTree(departments, isAdmin ? '' : user.departmentId || '');
  }

  async searchUsers(actor: Actor, query: OrganizationUsersQueryDto) {
    const user = await this.requireUser(actor.id);
    const isAdminAll = actor.role === 'systemAdmin' && query.scope === 'all';
    const departmentId = isAdminAll
      ? query.departmentId
      : user.departmentId || '';
    const where: Record<string, unknown> = {
      ...(query.activeOnly ? { employmentStatus: 'active' } : {}),
      ...(departmentId ? { departmentId } : {})
    };
    if (query.keyword?.trim()) {
      const keyword = query.keyword.trim();
      where.OR = [
        { name: { contains: keyword } },
        { account: { contains: keyword } },
        { jobTitle: { contains: keyword } }
      ];
    }
    const users = await this.repository.findUsers({
      where,
      include: { departmentEntity: true, manager: true },
      orderBy: [{ name: 'asc' }]
    });
    return users.map(toDirectoryItem);
  }

  async createDepartment(actor: Actor, body: CreateDepartmentDto) {
    this.requireAdmin(actor);
    await this.validateParent(body.parentId);
    await this.validateLeader(body.leaderId);
    const created = await this.repository.createDepartment({
      id: uuid(),
      name: body.name.trim(),
      parent: body.parentId ? { connect: { id: body.parentId } } : undefined,
      leader: body.leaderId ? { connect: { id: body.leaderId } } : undefined,
      sortOrder: body.sortOrder,
      status: body.status
    });
    await this.writeAudit(actor, 'create_department', created.id, created);
    return created;
  }

  async updateDepartment(actor: Actor, id: string, body: UpdateDepartmentDto) {
    this.requireAdmin(actor);
    const current = await this.requireDepartment(id);
    if (body.parentId !== undefined) {
      await this.validateParent(body.parentId, id);
      if (body.parentId && await this.hasDepartmentCycle(id, body.parentId)) {
        this.bad('部门层级不能形成循环');
      }
    }
    if (body.leaderId !== undefined) await this.validateLeader(body.leaderId);
    if (body.status === 'inactive' && await this.hasActiveMembers(id)) {
      this.bad('部门存在在职成员，不能停用');
    }
    const updated = await this.repository.updateDepartment(id, {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.parentId !== undefined ? { parent: body.parentId ? { connect: { id: body.parentId } } : { disconnect: true } } : {}),
      ...(body.leaderId !== undefined ? { leader: body.leaderId ? { connect: { id: body.leaderId } } : { disconnect: true } } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
      ...(body.status !== undefined ? { status: body.status } : {})
    });
    await this.writeAudit(actor, 'update_department', id, { before: current, after: updated });
    return updated;
  }

  async updateUserOrganization(actor: Actor, id: string, body: UpdateUserOrganizationDto) {
    await this.requireHrOrAdmin(actor);
    const current = await this.requireUser(id);
    if (Object.keys(body).length === 0) this.bad('至少提供一个组织字段');
    const departmentId = body.departmentId ?? current.departmentId;
    if (departmentId) await this.validateActiveDepartment(departmentId);
    const managerId = body.managerId === undefined ? current.managerId : body.managerId;
    if (managerId) await this.validateManager(id, managerId);
    if (body.employmentStatus === 'active' && !departmentId) this.bad('在职员工必须归属启用部门');
    const department = body.departmentId !== undefined && departmentId
      ? await this.repository.findDepartment(departmentId)
      : null;
    const updated = await this.repository.updateUserOrganization(id, {
      ...(body.departmentId !== undefined && department ? { departmentEntity: { connect: { id: department.id } }, department: department.name } : {}),
      ...(body.managerId !== undefined ? { manager: managerId ? { connect: { id: managerId } } : { disconnect: true } } : {}),
      ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle.trim() } : {}),
      ...(body.role !== undefined ? { role: body.role, roleLabel: this.roleLabel(body.role) } : {}),
      ...(body.employmentStatus !== undefined ? { employmentStatus: body.employmentStatus } : {})
    });
    await this.writeAudit(actor, 'update_user_organization', id, { before: current, after: updated });
    return toDirectoryItem(updated);
  }

  async createUser(actor: Actor, body: CreateUserDto) {
    await this.requireHrOrAdmin(actor);
    await this.validateActiveDepartment(body.departmentId);
    if (body.managerId) await this.validateManager('', body.managerId);
    const existing = await this.repository.findUsers({ where: { account: body.account.trim() }, select: { id: true } });
    if (existing.length > 0) this.bad('账号已存在');
    const department = await this.repository.findDepartment(body.departmentId);
    const created = await this.repository.createUser({
      id: uuid(),
      name: body.name.trim(),
      account: body.account.trim(),
      passwordHash: await bcrypt.hash(body.password, 10),
      department: department!.name,
      departmentEntity: { connect: { id: body.departmentId } },
      manager: body.managerId ? { connect: { id: body.managerId } } : undefined,
      jobTitle: body.jobTitle.trim(),
      employmentStatus: 'active',
      role: body.role,
      roleLabel: this.roleLabel(body.role),
      permissionsJson: '[]',
      favoriteKnowledgeIdsJson: '[]',
      recentKnowledgeIdsJson: '[]',
      todoCount: 0
    });
    await this.writeAudit(actor, 'create_user', created.id, created);
    return toDirectoryItem(created);
  }

  async deactivateUser(actor: Actor, id: string) {
    await this.requireHrOrAdmin(actor);
    const current = await this.requireUser(id);
    if (current.id === actor.id) this.bad('不能停用当前登录用户');
    const updated = await this.repository.deactivateUser(id);
    await this.repository.revokeUserSessions(id);
    await this.writeAudit(actor, 'deactivate_user', id, { before: current, after: updated });
    return toDirectoryItem(updated);
  }

  private async requireUser(id: string) {
    const user = await this.repository.findUser(id);
    if (!user) throw new AppException(1004, '用户不存在', HttpStatus.NOT_FOUND);
    return user;
  }

  private async requireDepartment(id: string) {
    const department = await this.repository.findDepartment(id);
    if (!department) throw new AppException(1004, '部门不存在', HttpStatus.NOT_FOUND);
    return department;
  }

  private requireAdmin(actor: Actor) {
    if (actor.role !== 'systemAdmin') throw new AppException(1003, '仅系统管理员可维护组织关系', HttpStatus.FORBIDDEN);
  }

  private async requireHrOrAdmin(actor: Actor) {
    if (actor.role === 'systemAdmin') return;
    const current = await this.repository.findUser(actor.id);
    if (current?.departmentId === 'd-hr') return;
    throw new AppException(1003, '仅 HR 或系统管理员可维护员工', HttpStatus.FORBIDDEN);
  }

  private roleLabel(role: string) {
    return ({ employee: '普通员工', approver: '审批人', systemAdmin: '系统管理员', knowledgeAdmin: '知识管理员' } as Record<string, string>)[role] || role;
  }

  private async validateActiveDepartment(id: string) {
    const department = await this.requireDepartment(id);
    if (department.status !== 'active') this.bad('部门未启用');
  }

  private async validateParent(parentId?: string | null, selfId?: string) {
    if (!parentId) return;
    if (parentId === selfId) this.bad('部门不能将自身设为上级');
    await this.validateActiveDepartment(parentId);
  }

  private async validateLeader(leaderId?: string | null) {
    if (!leaderId) return;
    const leader = await this.repository.findUser(leaderId);
    if (!leader || leader.employmentStatus !== 'active') this.bad('部门负责人必须是在职员工');
  }

  private async validateManager(employeeId: string, managerId: string) {
    if (employeeId === managerId) this.bad('员工不能向自己汇报');
    const manager = await this.repository.findUser(managerId);
    if (!manager || manager.employmentStatus !== 'active') this.bad('直属上级必须是在职员工');
    let currentId: string | null = managerId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === employeeId) this.bad('汇报链不能形成循环');
      if (visited.has(currentId)) this.bad('现有汇报链已形成循环');
      visited.add(currentId);
      const current = await this.repository.findUser(currentId);
      currentId = current?.managerId || null;
    }
  }

  private async hasDepartmentCycle(id: string, parentId?: string) {
    let currentId = parentId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === id) return true;
      if (visited.has(currentId)) return true;
      visited.add(currentId);
      currentId = (await this.repository.findDepartment(currentId))?.parentId || undefined;
    }
    return false;
  }

  private async hasActiveMembers(departmentId: string) {
    return (await this.repository.findUsers({ where: { departmentId, employmentStatus: 'active' }, select: { id: true } })).length > 0;
  }

  private async buildTree(departments: Array<{ id: string; name: string; parentId: string | null; leaderId: string | null; sortOrder: number; status: string }>, rootId: string) {
    const byParent = new Map<string, typeof departments>();
    for (const department of departments) {
      const key = department.parentId || '';
      const items = byParent.get(key) || [];
      items.push(department);
      byParent.set(key, items);
    }
    const build = async (parentId: string): Promise<unknown[]> => {
      const children = byParent.get(parentId) || [];
      return Promise.all(children.map(async department => {
        const leader = department.leaderId ? await this.repository.findUser(department.leaderId) : null;
        return toDepartmentNode(department, leader?.name || '', await build(department.id));
      }));
    };
    if (!rootId) return build('');
    const root = departments.find(department => department.id === rootId);
    if (!root) return [];
    const leader = root.leaderId ? await this.repository.findUser(root.leaderId) : null;
    return [toDepartmentNode(root, leader?.name || '', await build(root.id))];
  }

  private async writeAudit(actor: Actor, action: string, targetId: string, detail: unknown) {
    await this.repository.createAuditLog({
      id: uuid(),
      module: 'organization',
      action,
      operatorName: actor.name,
      operatorRole: actor.role,
      riskLevel: 'normal',
      detail: JSON.stringify({ targetId, detail }),
      time: formatDateTime()
    });
  }

  private bad(message: string): never {
    throw new AppException(1001, message, HttpStatus.BAD_REQUEST);
  }
}
