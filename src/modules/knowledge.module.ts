import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
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

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
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

  @Get('articles')
  async getArticles(@Req() request: AuthenticatedRequest, @Query() query: ArticleListQueryDto) {
    return this.knowledgeService.getArticles(request.user!.id, query);
  }

  @Get('articles/:id')
  async getArticle(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.knowledgeService.getArticle(request.user!.id, id);
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
