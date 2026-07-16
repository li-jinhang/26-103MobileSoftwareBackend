import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { ok } from '../common/app-response';
import { AppException } from '../common/app-exception';
import { AuthGuard } from '../common/auth.guard';
import { formatDateTime, parseJsonArray, toJson } from '../common/helpers';
import { PrismaService } from '../prisma/prisma.service';

class ArticleListQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class CorrectionDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description = '';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder = 0;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  summary = '';

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags: string[] = [];

  @IsOptional()
  @IsIn(['draft', 'published', 'offline'])
  status = 'published';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments: string[] = [];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedWorkflowIds: string[] = [];
}

class UpdateArticleDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsIn(['draft', 'published', 'offline'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedWorkflowIds?: string[];
}

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
    role: string;
  };
};

@Injectable()
class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories() {
    const categories = await this.prisma.knowledgeCategory.findMany({
      orderBy: {
        sortOrder: 'asc'
      }
    });

    return ok(
      categories.map((item: { id: string; name: string; description: string }) => ({
        id: item.id,
        name: item.name,
        description: item.description
      }))
    );
  }

  async getArticles(userId: string, query: ArticleListQueryDto) {
    const favoriteIds = await this.getFavoriteIds(userId);
    const keyword = query.keyword?.trim().toLowerCase();
    const status = query.status ?? 'published';
    const categoryId = query.categoryId;

    const articles = await this.prisma.knowledgeArticle.findMany({
      where: {
        status
      }
    });

    const filtered = articles
      .filter((item: { categoryId: string }) => !categoryId || categoryId === 'all' || item.categoryId === categoryId)
      .filter((item: { title: string; summary: string; content: string; categoryName: string }) => {
        if (!keyword) {
          return true;
        }
        return [item.title, item.summary, item.content, item.categoryName]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      })
      .map((item: {
        id: string;
        title: string;
        summary: string;
        content: string;
        categoryId: string;
        categoryName: string;
        tagsJson: string;
        updateTime: string;
        version: string;
        status: string;
        attachmentsJson: string;
        relatedWorkflowIdsJson: string;
      }) => this.toArticleResponse(item, favoriteIds));

    return ok(filtered);
  }

  async getArticle(userId: string, id: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id
      }
    });

    if (!article) {
      throw new AppException(1004, '文章不存在', HttpStatus.NOT_FOUND);
    }

    return ok(this.toArticleResponse(article, await this.getFavoriteIds(userId)));
  }

  async favorite(userId: string, articleId: string, favorite: boolean) {
    await this.ensureArticleExists(articleId);
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!user) {
      throw new AppException(1002, '未登录或 Token 无效', HttpStatus.UNAUTHORIZED);
    }

    const favorites = new Set(parseJsonArray<string>(user.favoriteKnowledgeIdsJson));
    if (favorite) {
      favorites.add(articleId);
    } else {
      favorites.delete(articleId);
    }

    await this.prisma.user.update({
      where: {
        id: userId
      },
      data: {
        favoriteKnowledgeIdsJson: toJson(Array.from(favorites))
      }
    });

    return ok(
      {
        articleId,
        favorite
      },
      favorite ? '收藏成功' : '取消收藏成功'
    );
  }

  async createCorrection(userId: string, articleId: string, content: string) {
    await this.ensureArticleExists(articleId);

    const correction = await this.prisma.knowledgeCorrection.create({
      data: {
        id: `correction-${Date.now()}`,
        articleId,
        userId,
        content,
        createTime: formatDateTime()
      }
    });

    return ok(
      {
        id: correction.id,
        articleId: correction.articleId,
        content: correction.content,
        createTime: correction.createTime
      },
      '提交成功'
    );
  }

  async createCategory(role: string, body: CreateCategoryDto) {
    this.requireKnowledgeAdmin(role);
    const category = await this.prisma.knowledgeCategory.create({
      data: { id: `cat-${Date.now()}`, name: body.name.trim(), description: body.description.trim(), sortOrder: body.sortOrder }
    });
    return category;
  }

  async updateCategory(role: string, id: string, body: UpdateCategoryDto) {
    this.requireKnowledgeAdmin(role);
    const category = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!category) throw new AppException(1004, '分类不存在', HttpStatus.NOT_FOUND);
    return this.prisma.knowledgeCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {})
      }
    });
  }

  async createArticle(role: string, body: CreateArticleDto) {
    this.requireKnowledgeAdmin(role);
    const category = await this.requireCategory(body.categoryId);
    const article = await this.prisma.knowledgeArticle.create({
      data: {
        id: `article-${Date.now()}`,
        title: body.title.trim(),
        summary: body.summary.trim(),
        content: body.content.trim(),
        categoryId: category.id,
        categoryName: category.name,
        tagsJson: toJson(body.tags),
        updateTime: formatDateTime(),
        version: 'v1.0',
        status: body.status,
        attachmentsJson: toJson(body.attachments),
        relatedWorkflowIdsJson: toJson(body.relatedWorkflowIds)
      }
    });
    return this.toArticleResponse(article, []);
  }

  async updateArticle(role: string, id: string, body: UpdateArticleDto) {
    this.requireKnowledgeAdmin(role);
    await this.ensureArticleExists(id);
    const category = body.categoryId === undefined ? null : await this.requireCategory(body.categoryId);
    const article = await this.prisma.knowledgeArticle.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title.trim() } : {}),
        ...(body.summary !== undefined ? { summary: body.summary.trim() } : {}),
        ...(body.content !== undefined ? { content: body.content.trim() } : {}),
        ...(category ? { categoryId: category.id, categoryName: category.name } : {}),
        ...(body.tags !== undefined ? { tagsJson: toJson(body.tags) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
        ...(body.attachments !== undefined ? { attachmentsJson: toJson(body.attachments) } : {}),
        ...(body.relatedWorkflowIds !== undefined ? { relatedWorkflowIdsJson: toJson(body.relatedWorkflowIds) } : {}),
        updateTime: formatDateTime()
      }
    });
    return this.toArticleResponse(article, []);
  }

  async deleteArticle(role: string, id: string) {
    this.requireKnowledgeAdmin(role);
    await this.ensureArticleExists(id);
    const article = await this.prisma.knowledgeArticle.update({ where: { id }, data: { status: 'offline', updateTime: formatDateTime() } });
    return { id: article.id, status: article.status };
  }

  private async ensureArticleExists(articleId: string) {
    const article = await this.prisma.knowledgeArticle.findUnique({
      where: {
        id: articleId
      }
    });

    if (!article) {
      throw new AppException(1004, '文章不存在', HttpStatus.NOT_FOUND);
    }
  }

  private async requireCategory(id: string) {
    const category = await this.prisma.knowledgeCategory.findUnique({ where: { id } });
    if (!category || category.id === 'all') throw new AppException(1004, '分类不存在', HttpStatus.NOT_FOUND);
    return category;
  }

  private requireKnowledgeAdmin(role: string) {
    if (!['knowledgeAdmin', 'systemAdmin'].includes(role)) {
      throw new AppException(1003, '仅知识管理员或系统管理员可维护知识库', HttpStatus.FORBIDDEN);
    }
  }

  private async getFavoriteIds(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    return user ? parseJsonArray(user.favoriteKnowledgeIdsJson) : [];
  }

  private toArticleResponse(
    item: {
      id: string;
      title: string;
      summary: string;
      content: string;
      categoryId: string;
      categoryName: string;
      tagsJson: string;
      updateTime: string;
      version: string;
      status: string;
      attachmentsJson: string;
      relatedWorkflowIdsJson: string;
    },
    favoriteIds: string[]
  ) {
    return {
      id: item.id,
      title: item.title,
      summary: item.summary,
      content: item.content,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      tags: parseJsonArray(item.tagsJson),
      updateTime: item.updateTime,
      version: item.version,
      status: item.status,
      attachments: parseJsonArray(item.attachmentsJson),
      relatedWorkflowIds: parseJsonArray(item.relatedWorkflowIdsJson),
      favorite: favoriteIds.includes(item.id)
    };
  }
}

@Controller('knowledge')
@UseGuards(AuthGuard)
class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get('categories')
  async getCategories() {
    return this.knowledgeService.getCategories();
  }

  @Post('categories')
  async createCategory(@Req() request: AuthenticatedRequest, @Body() body: CreateCategoryDto) {
    return this.knowledgeService.createCategory(request.user!.role, body);
  }

  @Patch('categories/:id')
  async updateCategory(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateCategoryDto) {
    return this.knowledgeService.updateCategory(request.user!.role, id, body);
  }

  @Get('articles')
  async getArticles(@Req() request: AuthenticatedRequest, @Query() query: ArticleListQueryDto) {
    return this.knowledgeService.getArticles(request.user!.id, query);
  }

  @Get('articles/:id')
  async getArticle(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.knowledgeService.getArticle(request.user!.id, id);
  }

  @Post('articles')
  async createArticle(@Req() request: AuthenticatedRequest, @Body() body: CreateArticleDto) {
    return this.knowledgeService.createArticle(request.user!.role, body);
  }

  @Patch('articles/:id')
  async updateArticle(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdateArticleDto) {
    return this.knowledgeService.updateArticle(request.user!.role, id, body);
  }

  @Delete('articles/:id')
  async deleteArticle(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.knowledgeService.deleteArticle(request.user!.role, id);
  }

  @Post('articles/:id/favorite')
  async favorite(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.knowledgeService.favorite(request.user!.id, id, true);
  }

  @Delete('articles/:id/favorite')
  async unfavorite(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.knowledgeService.favorite(request.user!.id, id, false);
  }

  @Post('articles/:id/corrections')
  async createCorrection(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: CorrectionDto
  ) {
    return this.knowledgeService.createCorrection(request.user!.id, id, body.content);
  }
}

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, AuthGuard, PrismaService]
})
export class KnowledgeModule {}
