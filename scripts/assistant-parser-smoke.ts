import { strict as assert } from 'node:assert';
import { parseAssistantModelContent } from '../src/common/assistant-result';

const allowedKnowledgeIds = new Set(['k1']);
const allowedWorkflowIds = new Set(['wf1', 'wf2', 'wf3', 'wf4']);
const valid = parseAssistantModelContent(JSON.stringify({
  answer: '请查看请假制度。',
  recognizedText: '',
  intent: 'leave',
  relatedKnowledgeIds: ['k1', 'missing'],
  recommendedWorkflowId: 'wf1',
  confidence: 0.92,
  formDraft: {
    title: '病假申请', extra: '病假', date: '2026-07-17 14:00-18:00',
    amount: '', reason: '身体不适', attachment: ''
  },
  missingFields: []
}), allowedKnowledgeIds, allowedWorkflowIds);
assert.equal(valid.recommendedWorkflowId, 'wf1');
assert.deepEqual(valid.relatedKnowledgeIds, ['k1']);
assert.equal(valid.formDraft.reason, '身体不适');

const invalid = parseAssistantModelContent(
  '{"answer":"x","intent":"reimbursement","recommendedWorkflowId":"wf999","formDraft":{"amount":"-10"}}',
  allowedKnowledgeIds,
  allowedWorkflowIds
);
assert.equal(invalid.recommendedWorkflowId, '');
assert.equal(invalid.formDraft.amount, '');
assert.throws(() => parseAssistantModelContent('not-json', new Set(), new Set()));
console.log('assistant parser smoke passed');
