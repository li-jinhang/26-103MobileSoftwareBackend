import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ok } from '../../common/app-response';
import { AuthGuard } from '../../common/auth.guard';
import { CreateDepartmentDto, CreateUserDto, OrganizationUsersQueryDto, UpdateDepartmentDto, UpdateUserOrganizationDto } from './organization.dto';
import { OrganizationService } from './organization.service';

type AuthenticatedRequest = Request & { user?: { id: string; name: string; role: string } };

@Controller('organization')
@UseGuards(AuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('me')
  async me(@Req() request: AuthenticatedRequest) {
    return ok(await this.organizationService.getMyOrganization(request.user!.id));
  }

  @Get('departments/tree')
  async departmentTree(@Req() request: AuthenticatedRequest) {
    return ok(await this.organizationService.getDepartmentTree(request.user!));
  }

  @Get('users')
  async users(@Req() request: AuthenticatedRequest, @Query() query: OrganizationUsersQueryDto) {
    return ok(await this.organizationService.searchUsers(request.user!, query));
  }

  @Post('users')
  async createUser(@Req() request: AuthenticatedRequest, @Body() body: CreateUserDto) {
    return this.organizationService.createUser(request.user!, body);
  }

  @Post('departments')
  async createDepartment(@Req() request: AuthenticatedRequest, @Body() body: CreateDepartmentDto) {
    return ok(await this.organizationService.createDepartment(request.user!, body), '部门创建成功');
  }

  @Patch('departments/:id')
  async updateDepartment(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    return ok(await this.organizationService.updateDepartment(request.user!, id, body), '部门更新成功');
  }

  @Patch('users/:id/organization')
  async updateUserOrganization(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateUserOrganizationDto) {
    return this.organizationService.updateUserOrganization(request.user!, id, body);
  }

  @Delete('users/:id')
  async deactivateUser(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.organizationService.deactivateUser(request.user!, id);
  }
}
