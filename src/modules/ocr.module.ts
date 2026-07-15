import {
  Body,
  Controller,
  HttpStatus,
  Injectable,
  Module,
  Post,
  UseGuards
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { ok } from '../common/app-response';
import { AppException } from '../common/app-exception';
import { AuthGuard } from '../common/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

class OcrRequestDto {
  @IsString()
  @IsNotEmpty()
  imageBase64!: string;
}

interface OcrStructuredResult {
  success: boolean;
  text: string;
  keywords: string[];
  fields: Record<string, string>;
  error: string;
  provider: string;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}

function parseModelContent(content: string): OcrStructuredResult {
  const trimmed = content.trim();
  const candidates: string[] = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
      const keywords = Array.isArray(parsed.keywords)
        ? parsed.keywords.filter((item): item is string => typeof item === 'string').slice(0, 10)
        : [];
      const fields: Record<string, string> = {};
      if (parsed.fields && typeof parsed.fields === 'object') {
        Object.entries(parsed.fields as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === 'string') {
            fields[key] = value;
          }
        });
      }
      const success = parsed.success === true && text.length > 0;
      return {
        success,
        text,
        keywords,
        fields,
        error: success ? '' : (typeof parsed.error === 'string' ? parsed.error : '模型未返回可用识别文本'),
        provider: 'llm'
      };
    } catch {
      // Continue with the next candidate and return a controlled error if all fail.
    }
  }
  return {
    success: false,
    text: '',
    keywords: [],
    fields: {},
    error: '模型返回内容不是合法 JSON',
    provider: 'llm'
  };
}

@Injectable()
class OcrService {
  async recognize(imageBase64: string) {
    const baseUrl = (process.env.LLM_BASE_URL ?? '').replace(/\/$/, '');
    const apiKey = process.env.LLM_API_KEY ?? '';
    const model = process.env.LLM_MODEL ?? '';
    if (!baseUrl || !apiKey || !model) {
      throw new AppException(1007, '视觉大模型服务尚未配置', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: '你是图片文字识别服务。只能返回合法 JSON，禁止 Markdown 和解释文字。必须包含 success(boolean)、text(string)、keywords(string数组)、fields(字符串键值对象)、error(string)。识别失败时 success=false，其他内容使用空值，并填写 error。'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: '读取图片中的全部可见文字，并严格按要求返回 JSON。' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new AppException(1007, `视觉大模型请求失败: HTTP ${response.status}`, HttpStatus.BAD_GATEWAY);
    }
    const payload = await response.json() as OpenAiResponse;
    const content = payload.choices?.[0]?.message?.content;
    const modelText = typeof content === 'string'
      ? content
      : Array.isArray(content) ? content.map((item) => item.text ?? '').join('') : '';
    return ok(parseModelContent(modelText));
  }
}

@Controller('ocr')
@UseGuards(AuthGuard)
class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  @Post('recognize')
  async recognize(@Body() body: OcrRequestDto) {
    return this.ocrService.recognize(body.imageBase64);
  }
}

@Module({
  controllers: [OcrController],
  providers: [OcrService, AuthGuard, PrismaService]
})
export class OcrModule {}
