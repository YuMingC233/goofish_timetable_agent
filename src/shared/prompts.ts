import type { ScrapedConversation } from './types';
import { t } from './i18n';

export function formatChatForAI(conversation: ScrapedConversation): string {
  const header = `${t('aiBuyerLabel')}: ${conversation.buyerName || t('unknown')}`;
  const messages = conversation.messages.map((m) => {
    const name = m.senderName || (m.sender === 'buyer' ? t('aiBuyerLabel') : t('aiSellerLabel'));
    return `[${m.timestamp}] ${name}: ${m.content}`;
  }).join('\n');
  return `${header}\n---\n${messages}`;
}

export function buildPrompt(chatMessages: string): string {
  // Use zh_CN prompt for Chinese-speaking users, English prompt for others
  let locale = 'en';
  try { locale = chrome.i18n?.getUILanguage?.() || 'en'; } catch { /* use en */ }

  if (locale.startsWith('zh')) {
    return buildZhPrompt(chatMessages);
  }
  return buildEnPrompt(chatMessages);
}

function buildZhPrompt(chatMessages: string): string {
  return `你是一名排期助手。根据以下闲鱼聊天记录，提取结构化信息。

聊天记录：
---
${chatMessages || '{chat_messages}'}
---

只返回合法的 JSON（不要 markdown 格式或额外说明）：
{
  "buyerName": "买家昵称",
  "requirement": "简洁的需求描述",
  "urgency": "high|medium|low",
  "urgencyReason": "紧迫性判断依据（引用关键语句）",
  "price": 价格数字 或 null,
  "estimatedHours": 预估工时数字,
  "deadline": "ISO 日期字符串" 或 null,
  "specialNotes": "特殊要求或限制"
}`;
}

function buildEnPrompt(chatMessages: string): string {
  return `You are a scheduling assistant. Extract structured information from the following Xianyu chat conversation.

Chat log:
---
${chatMessages || '{chat_messages}'}
---

Return ONLY valid JSON (no markdown formatting or extra text):
{
  "buyerName": "Buyer's display name",
  "requirement": "Concise description of the requirement",
  "urgency": "high|medium|low",
  "urgencyReason": "Reason for urgency assessment (quote key phrases)",
  "price": price as a number or null,
  "estimatedHours": estimated hours as a number,
  "deadline": "ISO date string" or null,
  "specialNotes": "Special requirements or constraints" or null
}`;
}
