/**
 * Sync Notion database schema — all column names in Chinese.
 *
 * Usage: npx tsx scripts/sync-database-schema.ts
 *
 * - Removes English-named properties left over from earlier runs.
 * - Adds Chinese-named properties matching ScheduledTask DTO + NOTION_PROPERTY_KEYS.
 */

import { Client } from '@notionhq/client';
import * as fs from 'fs';
import * as path from 'path';

// ── Parse .env ──

const envPath = path.resolve(import.meta.dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
}

const NOTION_TOKEN = env['NOTION_TOKEN'];
if (!NOTION_TOKEN) {
  console.error('❌ NOTION_TOKEN not found in .env');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });
const DATABASE_ID = '37616695-04b0-8060-a466-e3c5ba29aac7';

// ── Select options (keep English labels — they're display values, not column names) ──

const URGENCY_OPTIONS = [
  { name: '🔴 High',   color: 'red' },
  { name: '🟡 Medium', color: 'yellow' },
  { name: '🟢 Low',    color: 'green' },
] as const;

const STATUS_OPTIONS = [
  { name: '📋 Scheduled',     color: 'blue' },
  { name: '🔄 In Progress',   color: 'orange' },
  { name: '✅ Done',          color: 'green' },
  { name: '❌ Cancelled',     color: 'gray' },
] as const;

// ── Chinese column names (must match NOTION_PROPERTY_KEYS in constants.ts) ──

const CHINESE_PROPERTIES: Record<string, any> = {
  买家: {
    rich_text: {},
  },
  需求描述: {
    rich_text: {},
  },
  紧急程度: {
    select: {
      options: URGENCY_OPTIONS,
    },
  },
  报价: {
    number: {
      format: 'yuan',
    },
  },
  预估工时: {
    number: {
      format: 'number',
    },
  },
  日期: {
    date: {},
  },
  开始时间: {
    date: {},
  },
  结束时间: {
    date: {},
  },
  状态: {
    select: {
      options: STATUS_OPTIONS,
    },
  },
  聊天链接: {
    url: {},
  },
  备注: {
    rich_text: {},
  },
};

// ── English property names to clean up ──

const OLD_ENGLISH_NAMES = [
  'Buyer',
  'Requirement',
  'Urgency',
  'Price (¥)',
  'Est. Hours',
  'Date',
  'Start Time',
  'End Time',
  'Status',
  'Chat Link',
  'Notes',
];

async function main() {
  console.log(`🔧 Syncing database "闲鱼排单" schema...\n`);
  console.log(`   URL: https://notion.so/${DATABASE_ID.replace(/-/g, '')}\n`);

  // 1. Fetch current state
  const db = await notion.databases.retrieve({ database_id: DATABASE_ID });
  const existingProps = (db as any).properties as Record<string, any>;

  console.log('📋 Current columns:');
  for (const name of Object.keys(existingProps)) {
    console.log(`   ${existingProps[name].type.padEnd(12)} ${name}`);
  }

  // 2. Build update payload
  const properties: Record<string, any> = {};

  // Remove old English-named properties
  let removed = 0;
  for (const name of OLD_ENGLISH_NAMES) {
    if (existingProps[name]) {
      removed++;
      console.log(`\n   🗑️  Removing "${name}"`);
      properties[name] = null; // null deletes the property
    }
  }

  // Add Chinese-named properties if missing
  let added = 0;
  let kept = 0;
  for (const [name, schema] of Object.entries(CHINESE_PROPERTIES)) {
    if (existingProps[name]) {
      kept++;
      console.log(`   ⏭️  "${name}" — already exists`);
      continue;
    }
    added++;
    console.log(`   ➕ "${name}" (${Object.keys(schema)[0]})`);
    properties[name] = schema;
  }

  // Handle title column
  if (existingProps['名称'] && existingProps['名称'].type === 'title') {
    console.log(`   ⏭️  "名称" — title column kept as-is`);
  }

  if (Object.keys(properties).length === 0) {
    console.log('\n✅ Schema is already up-to-date. Nothing to do.');
    return;
  }

  // 3. Apply update
  console.log(`\n🚀 Applying update (${Object.keys(properties).length} changes)...`);
  await notion.databases.update({
    database_id: DATABASE_ID,
    properties,
  });

  console.log('\n✅ Database schema synced!\n');
  console.log('📊 Final schema:');
  const final = await notion.databases.retrieve({ database_id: DATABASE_ID });
  for (const name of Object.keys((final as any).properties)) {
    console.log(`   ${(final as any).properties[name].type.padEnd(12)} ${name}`);
  }
}

main().catch((err) => {
  console.error('❌ Failed:', err.message);
  if (err.body) console.error('   Details:', JSON.stringify(err.body, null, 2));
  process.exit(1);
});
