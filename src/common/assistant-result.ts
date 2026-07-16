export type AssistantIntent = 'knowledge_query' | 'leave' | 'reimbursement' |
  'purchase' | 'permission' | 'unknown';

export interface AssistantFormDraft {
  title: string;
  extra: string;
  date: string;
  amount: string;
  reason: string;
  attachment: string;
}

export interface AssistantAnalysisResult {
  answer: string;
  recognizedText: string;
  intent: AssistantIntent;
  relatedKnowledgeIds: string[];
  recommendedWorkflowId: string;
  confidence: number;
  formDraft: AssistantFormDraft;
  missingFields: string[];
}

const INTENTS = new Set<AssistantIntent>([
  'knowledge_query', 'leave', 'reimbursement', 'purchase', 'permission', 'unknown'
]);

const EMPTY_DRAFT: AssistantFormDraft = {
  title: '', extra: '', date: '', amount: '', reason: '', attachment: ''
};

function stringValue(value: unknown, maxLength = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function stringArray(value: unknown, maxItems = 20): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function jsonCandidates(content: string): string[] {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    candidates.push(fenced[1].trim());
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    candidates.push(trimmed.slice(start, end + 1));
  }
  return candidates;
}

function parseObject(content: string): Record<string, unknown> {
  for (const candidate of jsonCandidates(content)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error('模型未返回合法 JSON');
}

function normalizeAmount(value: unknown): string {
  const amount = stringValue(value, 40);
  if (amount.length === 0 || !/^\d+(?:\.\d{1,2})?$/.test(amount)) {
    return '';
  }
  return Number(amount) >= 0 ? amount : '';
}

export function parseAssistantModelContent(
  content: string,
  allowedKnowledgeIds: Set<string>,
  allowedWorkflowIds: Set<string>
): AssistantAnalysisResult {
  const parsed = parseObject(content);
  const rawIntent = stringValue(parsed.intent, 40) as AssistantIntent;
  const draftSource = parsed.formDraft !== null && typeof parsed.formDraft === 'object'
    ? parsed.formDraft as Record<string, unknown>
    : {};
  const workflowId = stringValue(parsed.recommendedWorkflowId, 100);
  const confidenceValue = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
    ? parsed.confidence
    : 0;
  const result: AssistantAnalysisResult = {
    answer: stringValue(parsed.answer),
    recognizedText: stringValue(parsed.recognizedText),
    intent: INTENTS.has(rawIntent) ? rawIntent : 'unknown',
    relatedKnowledgeIds: stringArray(parsed.relatedKnowledgeIds)
      .filter((id) => allowedKnowledgeIds.has(id)),
    recommendedWorkflowId: allowedWorkflowIds.has(workflowId) ? workflowId : '',
    confidence: Math.max(0, Math.min(1, confidenceValue)),
    formDraft: {
      title: stringValue(draftSource.title, 200),
      extra: stringValue(draftSource.extra, 500),
      date: stringValue(draftSource.date, 200),
      amount: normalizeAmount(draftSource.amount),
      reason: stringValue(draftSource.reason, 2000),
      attachment: stringValue(draftSource.attachment, 500)
    },
    missingFields: stringArray(parsed.missingFields, 10)
  };
  if (result.recommendedWorkflowId.length === 0) {
    result.formDraft = { ...EMPTY_DRAFT };
    result.missingFields = [];
  }
  return result;
}
