import { HttpStatus } from '@nestjs/common';
import { AppException } from './app-exception';

export interface LlmMessage {
  role: 'system' | 'user';
  content: unknown;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
}

export async function requestLlmJson(messages: LlmMessage[]): Promise<string> {
  const baseUrl = (process.env.LLM_BASE_URL ?? '').replace(/\/$/, '');
  const apiKey = process.env.LLM_API_KEY ?? '';
  const model = process.env.LLM_MODEL ?? '';
  if (!baseUrl || !apiKey || !model) {
    throw new AppException(1007, '大模型服务尚未配置', HttpStatus.SERVICE_UNAVAILABLE);
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
      messages
    })
  });

  if (!response.ok) {
    throw new AppException(1007, `大模型请求失败: HTTP ${response.status}`, HttpStatus.BAD_GATEWAY);
  }

  const payload = await response.json() as OpenAiResponse;
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((item) => item.text ?? '').join('');
  }
  return '';
}
