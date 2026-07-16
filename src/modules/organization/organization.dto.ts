import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class OrganizationUsersQueryDto {
  @IsOptional()
  @IsIn(['department', 'team', 'all'])
  scope: 'department' | 'team' | 'all' = 'team';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  keyword?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => value === undefined || value === '' ? true : value === true || value === 'true')
  activeOnly = true;
}

export class CreateDepartmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  parentId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  leaderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder = 0;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status: 'active' | 'inactive' = 'active';
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @IsString()
  leaderId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}

export class UpdateUserOrganizationDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  departmentId?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' ? null : value)
  @IsString()
  managerId?: string | null;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  employmentStatus?: 'active' | 'inactive';
}
