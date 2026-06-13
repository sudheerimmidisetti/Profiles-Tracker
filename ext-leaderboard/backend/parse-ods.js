// parse-ods.js
// Reads the ODS spreadsheet from the project root and returns clean student records.
// ODS files are ZIP archives containing content.xml

'use strict';

const path   = require('path');
const AdmZip = require('adm-zip');

const ODS_PATH = path.join(__dirname, '../../Coding-Profiles-DR-7.0-04-06-2026.ods');

function extractUsername(url, platform) {
  if (!url) return '';
  url = url.trim();
  try {
    if (platform === 'lc') {
      const m = url.match(/leetcode\.com\/(?:u\/)?([^/?#\s]+)/);
      return m ? m[1].replace(/\/$/, '') : '';
    }
    if (platform === 'cc') {
      const m = url.match(/codechef\.com\/users\/([^/?#\s]+)/);
      return m ? m[1].replace(/\/$/, '') : '';
    }
    if (platform === 'hr') {
      let m = url.match(/hackerrank\.com\/profile\/([^/?#\s]+)/);
      if (m) return m[1].replace(/\/$/, '');
      m = url.match(/hackerrank\.com\/([^/?#\s]+)/);
      return m ? m[1].replace(/\/$/, '') : '';
    }
  } catch { return ''; }
  return '';
}

function parseOds() {
  const zip = new AdmZip(ODS_PATH);
  const xml = zip.readAsText('content.xml');

  // Extract rows using regex (fast, no XML parser dep needed)
  const rows = [];
  const rowPattern  = /<table:table-row[^>]*>([\s\S]*?)<\/table:table-row>/g;
  const cellPattern = /<table:table-cell([^>]*)>([\s\S]*?)<\/table:table-cell>|<table:table-cell([^/]*?)\/>/g;
  const textPattern = /<text:p[^>]*>([\s\S]*?)<\/text:p>/;
  const repeatRx    = /number-columns-repeated="(\d+)"/;

  let rowMatch;
  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const rowXml = rowMatch[1];
    const row    = [];
    let cellMatch;
    while ((cellMatch = cellPattern.exec(rowXml)) !== null) {
      const attrs  = (cellMatch[1] || '') + (cellMatch[3] || '');
      const inner  = cellMatch[2] || '';
      const repM   = attrs.match(repeatRx);
      const repeat = repM ? Math.min(parseInt(repM[1], 10), 10) : 1;
      const tm     = textPattern.exec(inner);
      const val    = tm ? tm[1].replace(/<[^>]+>/g, '').trim() : '';
      for (let i = 0; i < repeat; i++) row.push(val);
    }
    if (row.some(c => c)) rows.push(row);
  }

  if (rows.length < 2) throw new Error('Could not parse ODS — no data rows found');

  const headers  = rows[0];
  const students = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (key) => {
      const idx = headers.indexOf(key);
      return idx >= 0 ? (row[idx] || '').trim() : '';
    };

    const lcUrl = get('Leetcode');
    const ccUrl = get('Codechef');
    const hrUrl = get('HackerRank');

    if (!lcUrl && !ccUrl && !hrUrl) continue;

    students.push({
      student_id: get('Student ID') || get('S. No'),
      lc_handle:  extractUsername(lcUrl, 'lc'),
      cc_handle:  extractUsername(ccUrl, 'cc'),
      hr_handle:  extractUsername(hrUrl, 'hr'),
      lc_url: lcUrl,
      cc_url: ccUrl,
      hr_url: hrUrl,
    });
  }

  return students;
}

module.exports = { parseOds };
