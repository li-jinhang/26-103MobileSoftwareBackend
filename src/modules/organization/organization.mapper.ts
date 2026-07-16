import { OrganizationUser } from './organization.repository';

export function toDirectoryItem(user: OrganizationUser) {
  return {
    id: user.id,
    name: user.name,
    account: user.account,
    departmentId: user.departmentId || '',
    departmentName: user.departmentEntity?.name || user.department,
    jobTitle: user.jobTitle,
    managerId: user.managerId || '',
    managerName: user.manager?.name || '',
    role: user.role,
    roleLabel: user.roleLabel,
    employmentStatus: user.employmentStatus
  };
}

export function toDepartmentNode(
  department: {
    id: string;
    name: string;
    parentId: string | null;
    leaderId: string | null;
    sortOrder: number;
    status: string;
  },
  leaderName: string,
  children: unknown[]
) {
  return {
    id: department.id,
    name: department.name,
    parentId: department.parentId || '',
    leaderId: department.leaderId || '',
    sortOrder: department.sortOrder,
    status: department.status,
    leaderName,
    children
  };
}
