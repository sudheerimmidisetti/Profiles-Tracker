/**
 * mock-college-db.js
 * ─────────────────────────────────────────────────────────────
 * Fake college student database API for local testing.
 * Run:  node mock-college-db.js
 * Then set in .env:
 *   COLLEGE_DB_API_URL=http://localhost:4000/api/students
 *   COLLEGE_DB_API_KEY=mock-secret-key
 * ─────────────────────────────────────────────────────────────
 */

const http = require('http');
const url = require('url');

// ─────────────────────────────────────────────────────────────
// Fake student database — 20 pre-seeded students
// (emails must match COLLEGE_EMAIL_DOMAINS in your .env)
// ─────────────────────────────────────────────────────────────
const STUDENTS = {
  // Format: email → student record
  '23p31a0583@acet.ac.in': {
    full_name: 'Prasanna',
    roll_number: '23P31A0583',
    college: 'ACET',
    branch: 'CSE',
    phone: '9876543210'
  },
  '23p31a0537@acet.ac.in': {
    full_name: 'Gowrish',
    roll_number: '23P31A0537',
    college: 'ACET',
    branch: 'CSE',
    phone: '9876543211'
  },
  '23p31a0519@acet.ac.in': {
    full_name: 'Sudheer',
    roll_number: '22MH1A0503',
    college: 'ACET',
    branch: 'CSE',
    phone: '9876543212'
  },
  '23p31a0528@acet.ac.in': {
    full_name: 'Mahesh',
    roll_number: '23p31A0528',
    college: 'ACET',
    branch: 'CSE',
    phone: '9876543213'
  },
  '23mh1a1252@acet.ac.in': {
    full_name: 'Aravind',
    roll_number: '23MH1A1252',
    college: 'ACET',
    branch: 'IT',
    phone: '9876543214'
  },
  '23A91A6166@aec.edu.in': {
    full_name: 'Maliswari',
    roll_number: '23A91A6166',
    college: 'AEC',
    branch: 'AIML',
    phone: '9876543215'
  },
  'divya@acet.ac.in': {
    full_name: 'Divya Lakshmi',
    roll_number: '22MH1A0507',
    college: 'ACET',
    branch: 'AIML',
    phone: '9876543216'
  },
  'rahul@acet.ac.in': {
    full_name: 'Rahul Verma',
    roll_number: '22MH1A0508',
    college: 'ACET',
    branch: 'CSE',
    phone: '9876543217'
  },
  'nisha@acet.ac.in': {
    full_name: 'Nisha Gupta',
    roll_number: '22MH1A0509',
    college: 'ACET',
    branch: 'IT',
    phone: '9876543218'
  },
  'kiran@acet.ac.in': {
    full_name: 'Kiran Kumar',
    roll_number: '22MH1A0510',
    college: 'ACET',
    branch: 'EEE',
    phone: '9876543219'
  },
  // AEC domain students
  'vamsi@aec.edu.in': {
    full_name: 'Vamsi Krishna',
    roll_number: '22AE1A0101',
    college: 'AEC',
    branch: 'CSE',
    phone: '9988776655'
  },
  'lakshmi@aec.edu.in': {
    full_name: 'Lakshmi Priya',
    roll_number: '22AE1A0102',
    college: 'AEC',
    branch: 'ECE',
    phone: '9988776656'
  },
  // Aditya University students
  'harish@adityauniversity.in': {
    full_name: 'Harish Chandra',
    roll_number: '22AU1A0301',
    college: 'Aditya University',
    branch: 'CSE',
    phone: '9111222333'
  },
  'meena@adityauniversity.in': {
    full_name: 'Meena Kumari',
    roll_number: '22AU1A0302',
    college: 'Aditya University',
    branch: 'AIDS',
    phone: '9111222334'
  },
  // Gmail (allowed in dev .env)
  'test@gmail.com': {
    full_name: 'Test Student',
    roll_number: 'TEST001',
    college: 'ACET',
    branch: 'CSE',
    phone: '9000000000'
  },
  'admin@gmail.com': {
    full_name: 'Admin Tester',
    roll_number: 'ADMIN001',
    college: 'ACET',
    branch: 'IT',
    phone: '9000000001'
  }
};

// ─────────────────────────────────────────────────────────────
// HTTP Server
// ─────────────────────────────────────────────────────────────
const PORT = 4000;
const API_KEY = 'mock-secret-key';

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // Auth check
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return send(res, 401, { error: 'Unauthorized: invalid API key' });
  }

  // GET /api/students                → list all students
  if (req.method === 'GET' && pathname === '/api/students') {
    return send(res, 200, {
      total: Object.keys(STUDENTS).length,
      students: Object.entries(STUDENTS).map(([email, s]) => ({ email, ...s }))
    });
  }

  // GET /api/students/:email         → single student lookup
  const match = pathname.match(/^\/api\/students\/(.+)$/);
  if (req.method === 'GET' && match) {
    const email = decodeURIComponent(match[1]).toLowerCase();
    const student = STUDENTS[email];
    if (!student) {
      // Auto-generate stub for unknown emails (useful for testing)
      const prefix = email.split('@')[0];
      const domain = email.split('@')[1];
      const college = domain.includes('aec') ? 'AEC'
        : domain.includes('aditya') ? 'Aditya University'
          : 'ACET';
      return send(res, 200, {
        full_name: `${prefix.charAt(0).toUpperCase() + prefix.slice(1)} (Update Me)`,
        roll_number: prefix.toUpperCase(),
        college,
        branch: 'CSE',
        phone: '0000000000'
      });
    }
    return send(res, 200, student);
  }

  return send(res, 404, { error: 'Not found' });
});

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

server.listen(PORT, () => {
  console.log(`\n✅  Mock College DB running at http://localhost:${PORT}`);
  console.log(`    API Key: ${API_KEY}`);
  console.log(`    Students loaded: ${Object.keys(STUDENTS).length}`);
  console.log('\n📋  Test endpoints:');
  console.log(`    GET http://localhost:${PORT}/api/students`);
  console.log(`    GET http://localhost:${PORT}/api/students/prasanna@acet.ac.in`);
  console.log(`    (send header: X-Api-Key: ${API_KEY})\n`);
});
