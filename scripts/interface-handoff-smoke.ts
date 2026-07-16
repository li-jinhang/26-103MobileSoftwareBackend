import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: 'employee01', password: '123456' })
    });
    const login = await loginResponse.json() as { token?: string; code?: number };
    expect(loginResponse.ok && login.token, 'Login did not return a token.');
    expect(login.code === undefined, 'Login response still uses the legacy data envelope.');

    const headers = { Authorization: `Bearer ${login.token}` };
    const [summaryResponse, messagesResponse, organizationResponse, articlesResponse] = await Promise.all([
      fetch(`${baseUrl}/collaboration/summary?focus=all`, { headers }),
      fetch(`${baseUrl}/messages/feed`, { headers }),
      fetch(`${baseUrl}/organization/me`, { headers }),
      fetch(`${baseUrl}/knowledge/articles`, { headers })
    ]);
    const summary = await summaryResponse.json() as { actionCount?: number; waitingCount?: number; meetingItems?: unknown[] };
    const messages = await messagesResponse.json();
    const organization = await organizationResponse.json() as { employee?: unknown; directReports?: unknown[] };
    const articles = await articlesResponse.json();

    expect(summaryResponse.ok && typeof summary.actionCount === 'number' && typeof summary.waitingCount === 'number', 'Collaboration summary contract failed.');
    expect(Array.isArray(summary.meetingItems), 'Collaboration summary is missing meeting items.');
    expect(messagesResponse.ok && Array.isArray(messages), 'Message feed contract failed.');
    expect(organizationResponse.ok && organization.employee && Array.isArray(organization.directReports), 'Organization profile contract failed.');
    expect(articlesResponse.ok && Array.isArray(articles), 'Knowledge article list contract failed.');

    console.log('Interface handoff smoke test passed.');
  } finally {
    await app?.close();
  }
}

void main();
