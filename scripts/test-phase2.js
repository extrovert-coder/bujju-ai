// ====================================================================
// BUJJU AI - PHASE 2 AUTOMATED TEST SUITE
// Tests File Assistant (TXT, CSV, JSON, DOCX, validation) and
// Reminders (CRUD, isolation, validation, timezone handling)
// ====================================================================

import JSZip from 'jszip'

const BASE_URL = 'http://localhost:5000'
const USER_A = 'test-user-alpha'
const USER_B = 'test-user-beta'

const results = []

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${testName} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`)
    results.push({ name: testName, pass: true })
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${testName} - FAILED! ${detail}`)
    results.push({ name: testName, pass: false, detail })
  }
}

// Helper: build multipart FormData in native Node fetch
function makeFormData(fieldName, fileName, fileBuffer, mimeType) {
  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: mimeType })
  formData.append(fieldName, blob, fileName)
  return formData
}

// Generate valid minimal DOCX buffer in memory using JSZip
async function createValidDocxBuffer(sampleText) {
  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  )
  zip.folder('_rels').file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  )
  zip.folder('word').file(
    'document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>${sampleText}</w:t></w:r></w:p>
  </w:body>
</w:document>`
  )
  return await zip.generateAsync({ type: 'nodebuffer' })
}

async function runTests() {
  console.log('\n======================================================')
  console.log('       BUJJU AI - PHASE 2 VERIFICATION SUITE         ')
  console.log('======================================================\n')

  // ------------------------------------------------------------------
  // 1. FILE ASSISTANT TESTS
  // ------------------------------------------------------------------
  console.log('\x1b[36m[PART A] FILE ASSISTANT UPLOADS & VALIDATION\x1b[0m')

  // Test 1.1: TXT Upload
  try {
    const txtContent = Buffer.from('Bujju AI is an intelligent assistant capable of parsing plain text.')
    const form = makeFormData('file', 'notes.txt', txtContent, 'text/plain')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 200 && data.success && data.file_type === '.txt', 'Upload valid TXT file', `file_id: ${data.file_id?.slice(0, 8)}...`)
  } catch (err) {
    assert(false, 'Upload valid TXT file', err.message)
  }

  // Test 1.2: CSV Upload
  try {
    const csvContent = Buffer.from('id,name,role,department\n101,Bujju,AI Assistant,Engineering\n102,User,Owner,Product')
    const form = makeFormData('file', 'team.csv', csvContent, 'text/csv')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 200 && data.success && data.file_type === '.csv', 'Upload valid CSV spreadsheet', `file_id: ${data.file_id?.slice(0, 8)}...`)
  } catch (err) {
    assert(false, 'Upload valid CSV spreadsheet', err.message)
  }

  // Test 1.3: JSON Upload
  try {
    const jsonContent = Buffer.from(JSON.stringify({ app: 'Bujju AI', version: '2.0.0', features: ['File Assistant', 'Reminders'] }, null, 2))
    const form = makeFormData('file', 'metadata.json', jsonContent, 'application/json')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 200 && data.success && data.file_type === '.json', 'Upload valid JSON document', `file_id: ${data.file_id?.slice(0, 8)}...`)
  } catch (err) {
    assert(false, 'Upload valid JSON document', err.message)
  }

  // Test 1.4: DOCX Upload
  try {
    const docxBuffer = await createValidDocxBuffer('Bujju AI Phase 2 Word Document Assistant Test Document')
    const form = makeFormData('file', 'document.docx', docxBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 200 && data.success && data.file_type === '.docx', 'Upload valid DOCX Word document', `file_id: ${data.file_id?.slice(0, 8)}...`)
  } catch (err) {
    assert(false, 'Upload valid DOCX Word document', err.message)
  }

  // Test 1.5: Malformed JSON File (Syntax Error)
  try {
    const badJson = Buffer.from('{ "broken": "unclosed string ')
    const form = makeFormData('file', 'corrupted.json', badJson, 'application/json')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('JSON parsing error'), 'Reject malformed JSON with descriptive 400 error', data.error)
  } catch (err) {
    assert(false, 'Reject malformed JSON', err.message)
  }

  // Test 1.6: Corrupted DOCX File (Binary noise)
  try {
    const badDocx = Buffer.from('PK\x03\x04This is not a real zip or docx file!!')
    const form = makeFormData('file', 'fake.docx', badDocx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('Word document error'), 'Reject corrupted DOCX with descriptive 400 error', data.error)
  } catch (err) {
    assert(false, 'Reject corrupted DOCX', err.message)
  }

  // Test 1.7: Empty File
  try {
    const emptyBuf = Buffer.alloc(0)
    const form = makeFormData('file', 'empty.txt', emptyBuf, 'text/plain')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('empty'), 'Reject empty 0-byte file with 400 error', data.error)
  } catch (err) {
    assert(false, 'Reject empty file', err.message)
  }

  // Test 1.8: Unsupported File Extension
  try {
    const exeBuf = Buffer.from('MZ\x90\x00')
    const form = makeFormData('file', 'script.exe', exeBuf, 'application/octet-stream')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('Invalid file type'), 'Reject unsupported executable/extension', data.error)
  } catch (err) {
    assert(false, 'Reject unsupported file', err.message)
  }

  // Test 1.9: Oversized File (> 10MB)
  try {
    const bigBuf = Buffer.alloc(11 * 1024 * 1024, 'A')
    const form = makeFormData('file', 'huge.txt', bigBuf, 'text/plain')
    const res = await fetch(`${BASE_URL}/api/files/upload`, {
      method: 'POST',
      headers: { 'x-user-id': USER_A },
      body: form,
    })
    const data = await res.json()
    assert(res.status === 400 && (data.error?.includes('10 MB') || data.error?.includes('too large')), 'Reject oversized file exceeding 10 MB', data.error)
  } catch (err) {
    assert(false, 'Reject oversized file', err.message)
  }

  // ------------------------------------------------------------------
  // 2. REMINDERS CRUD & USER ISOLATION TESTS
  // ------------------------------------------------------------------
  console.log('\n\x1b[36m[PART B] REMINDERS CRUD & DATA ISOLATION\x1b[0m')

  let createdReminderId = null
  const sampleDueTime = new Date(Date.now() + 3600000).toISOString()

  // Test 2.1: Create Reminder for User A
  try {
    const res = await fetch(`${BASE_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_A,
      },
      body: JSON.stringify({
        title: 'Review Phase 2 Test Deliverables',
        notes: 'Confirm File Assistant and Reminders feature coverage.',
        due_at: sampleDueTime,
      }),
    })
    const data = await res.json()
    createdReminderId = data.reminder?.id
    assert(
      res.status === 201 && data.success && createdReminderId && data.reminder.completed === false,
      'Create reminder for User A (POST /api/reminders)',
      `id: ${createdReminderId?.slice(0, 8)}...`
    )
  } catch (err) {
    assert(false, 'Create reminder for User A', err.message)
  }

  // Test 2.2: List Reminders for User A
  try {
    const res = await fetch(`${BASE_URL}/api/reminders`, {
      headers: { 'x-user-id': USER_A },
    })
    const data = await res.json()
    const found = data.reminders?.find((r) => r.id === createdReminderId)
    assert(
      res.status === 200 && data.success && Boolean(found),
      'List reminders for User A includes created item (GET /api/reminders)',
      `Count: ${data.reminders?.length}`
    )
  } catch (err) {
    assert(false, 'List reminders for User A', err.message)
  }

  // Test 2.3: Update Reminder Title & Notes
  try {
    const res = await fetch(`${BASE_URL}/api/reminders/${createdReminderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_A,
      },
      body: JSON.stringify({
        title: 'Updated Phase 2 Deliverables',
        notes: 'Updated notes with more details.',
      }),
    })
    const data = await res.json()
    assert(
      res.status === 200 && data.reminder?.title === 'Updated Phase 2 Deliverables',
      'Update reminder title & notes (PUT /api/reminders/:id)'
    )
  } catch (err) {
    assert(false, 'Update reminder title & notes', err.message)
  }

  // Test 2.4: Toggle Complete Reminder
  try {
    const res = await fetch(`${BASE_URL}/api/reminders/${createdReminderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_A,
      },
      body: JSON.stringify({ completed: true }),
    })
    const data = await res.json()
    assert(
      res.status === 200 && data.reminder?.completed === true,
      'Mark reminder as completed (PUT /api/reminders/:id completed: true)'
    )
  } catch (err) {
    assert(false, 'Mark reminder as completed', err.message)
  }

  // Test 2.5: User Data Isolation - User B cannot see User A's reminder
  try {
    const res = await fetch(`${BASE_URL}/api/reminders`, {
      headers: { 'x-user-id': USER_B },
    })
    const data = await res.json()
    const found = data.reminders?.find((r) => r.id === createdReminderId)
    assert(
      res.status === 200 && !found,
      'User Data Isolation: User B cannot view User A reminders',
      `User B count: ${data.reminders?.length}`
    )
  } catch (err) {
    assert(false, 'User Isolation check', err.message)
  }

  // Test 2.6: User Data Isolation - User B cannot modify User A's reminder
  try {
    const res = await fetch(`${BASE_URL}/api/reminders/${createdReminderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_B,
      },
      body: JSON.stringify({ title: 'Hacked by User B' }),
    })
    assert(
      res.status === 404,
      'User Data Isolation: User B cannot modify User A reminder (returns 404)'
    )
  } catch (err) {
    assert(false, 'User Isolation modify check', err.message)
  }

  // Test 2.7: Delete Reminder for User A
  try {
    const res = await fetch(`${BASE_URL}/api/reminders/${createdReminderId}`, {
      method: 'DELETE',
      headers: { 'x-user-id': USER_A },
    })
    const data = await res.json()
    assert(res.status === 200 && data.success, 'Delete reminder for User A (DELETE /api/reminders/:id)')

    // Verify deletion in list
    const listRes = await fetch(`${BASE_URL}/api/reminders`, {
      headers: { 'x-user-id': USER_A },
    })
    const listData = await listRes.json()
    const found = listData.reminders?.find((r) => r.id === createdReminderId)
    assert(!found, 'Reminder confirmed removed from User A list after delete')
  } catch (err) {
    assert(false, 'Delete reminder check', err.message)
  }

  // Test 2.8: Validation - Reject Empty Title
  try {
    const res = await fetch(`${BASE_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_A,
      },
      body: JSON.stringify({
        title: '   ',
        due_at: sampleDueTime,
      }),
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('title'), 'Validation: Reject empty reminder title (400)', data.error)
  } catch (err) {
    assert(false, 'Reject empty title', err.message)
  }

  // Test 2.9: Validation - Reject Invalid Date
  try {
    const res = await fetch(`${BASE_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': USER_A,
      },
      body: JSON.stringify({
        title: 'Invalid Date Test',
        due_at: 'not-a-valid-timestamp',
      }),
    })
    const data = await res.json()
    assert(res.status === 400 && data.error?.includes('date/time'), 'Validation: Reject invalid due date/time format (400)', data.error)
  } catch (err) {
    assert(false, 'Reject invalid date', err.message)
  }

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log('\n======================================================')
  const passed = results.filter((r) => r.pass).length
  const failed = results.filter((r) => !r.pass).length
  console.log(`TOTAL TESTS: ${results.length} | \x1b[32mPASSED: ${passed}\x1b[0m | \x1b[31mFAILED: ${failed}\x1b[0m`)
  console.log('======================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Fatal test error:', e)
  process.exit(1)
})
