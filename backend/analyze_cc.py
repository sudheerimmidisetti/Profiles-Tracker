import re, json

with open('/tmp/cc_profile.html') as f:
    html = f.read()

# 1. Problems Solved
for m in re.finditer(r'Problems Solved[^\d]*(\d+)', html):
    print('SOLVED:', m.group(0)[:80])

# 2. Submission breakdown text
for kw in ['fully_solved', 'partial_solved', 'Wrong Answer', 'Correct Answer', 'solutions_accepted']:
    m = re.search(kw + r'[^0-9]*(\d+)', html, re.IGNORECASE)
    if m:
        print(f'  {kw}: {m.group(0)[:80]}')

# 3. Find any pie/chart variables
for s in re.findall(r'<script[^>]*>([\s\S]*?)</script>', html):
    if 'pie' in s.lower() or 'dataPoint' in s.lower():
        print('CHART SCRIPT:', s[:400])
        break

# 4. DSA rating
m = re.search(r'"dsa_rating"\s*:\s*(\d+)', html)
if m:
    print('DSA_RATING:', m.group(0))
m = re.search(r'dsa_rating.*?(\d+)', html[:5000])
if m:
    print('DSA_RATING2:', m.group(0)[:60])

# 5. H3 tags  
h3s = re.findall(r'<h3[^>]*>([^<]+)</h3>', html)
print('H3 tags:', h3s[:20])

# 6. Problems - look for article sections
import re
art = re.search(r'problems-solved([\s\S]{0,3000})', html)
if art:
    chunk = art.group(0)
    # Count <td> (each td = one problem link in old CodeChef)
    tds = len(re.findall(r'<td[^>]*>', chunk))
    hrefs = re.findall(r'href=["\']([^"\']+problems[^"\']+)["\']', chunk)
    h3s_here = re.findall(r'<h3[^>]*>([^<]+)</h3>', chunk)
    print('PROBLEMS SECTION: tds=%d, links=%d, h3s=%s' % (tds, len(hrefs), h3s_here[:5]))
    
# 7. Submission stats from the pie-like data
m = re.search(r'submissionsData\s*=\s*(\{[\s\S]*?\});', html)
if m:
    print('submissionsData:', m.group(1)[:300])

# 8. Look for total submissions count
for pat in [r'Total Submissions[^\d]*(\d+)', r'(\d+)\s*total\s*submissions']:
    m = re.search(pat, html, re.IGNORECASE)
    if m:
        print('TOTAL_SUBS:', m.group(0)[:80])
