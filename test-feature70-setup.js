const { execSync } = require('child_process');
const crypto = require('crypto');

const ADM_KEY = 'adm_test_key_001';
const AGT_KEY = 'agt_test_key_001';
const BASE = 'http://localhost:3003';

async function createConfession(index) {
  const agentId = crypto.randomUUID();

  // Create session
  const sessResp = JSON.parse(execSync(
    `curl -s -X POST ${BASE}/confessional/sessions -H "Authorization: Bearer ${ADM_KEY}" -H "Content-Type: application/json" -d '{"agent_id":"${agentId}"}'`
  ).toString());

  const sessionId = sessResp.session_id;

  // Submit confession
  const text = `LIMIT_TEST_70_ITEM_${String(index).padStart(3, '0')} This is test confession number ${index} for default limit verification.`;
  execSync(
    `curl -s -X POST ${BASE}/confessional/submit -H "Authorization: Bearer ${AGT_KEY}" -H "Content-Type: application/json" -H "X-Session-ID: ${sessionId}" -d '{"text":"${text}"}'`
  );

  return index;
}

async function main() {
  const needed = 15;
  console.log('Creating ' + needed + ' confessions...');

  for (let i = 1; i <= needed; i++) {
    createConfession(i);
    console.log('Created confession ' + i);
  }

  // Check total count
  const count = JSON.parse(execSync(`curl -s ${BASE}/confessional/count`).toString());
  console.log('Total confessions now:', count.count);
}

main();
