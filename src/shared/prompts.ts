import type { ScrapedConversation } from './types';

export function formatChatForAI(conversation: ScrapedConversation): string {
  const header = `买家: ${conversation.buyerName || 'Unknown'}`;
  const messages = conversation.messages.map((m) => {
    const name = m.senderName || (m.sender === 'buyer' ? 'Buyer' : 'Seller');
    return `[${m.timestamp}] ${name}: ${m.content}`;
  }).join('\n');
  return `${header}\n---\n${messages}`;
}

export function buildPrompt(chatMessages: string): string {
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
