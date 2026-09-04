// State
let teachers = [];
let indicators = [];
let currentTeacher = null;
let currentReport = null;
let currentChallenge = null;
let currentEthics = [];

// Init
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initYears();
  await loadTeachers();
  await loadIndicators();
  
  document.getElementById('teacherSelect').addEventListener('change', loadTeacherData);
  document.getElementById('yearSelect').addEventListener('change', loadTeacherData);
  document.getElementById('roundSelect').addEventListener('change', loadTeacherData);
  
  // Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Theme
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
});

function initTheme() {
  const saved = localStorage.getItem('pa-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeIcon').textContent = saved === 'dark' ? '☀️' : '🌙';
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('pa-theme', next);
  document.getElementById('themeIcon').textContent = next === 'dark' ? '☀️' : '🌙';
}

function initYears() {
  const yearSelect = document.getElementById('yearSelect');
  const currentYear = new Date().getFullYear() + 543;
  for (let y = currentYear - 2; y <= currentYear + 2; y++) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = y;
    if (y === currentYear) opt.selected = true;
    yearSelect.appendChild(opt);
  }
  
  // Admin selects
  const adminYear = document.getElementById('adminYearSelect');
  if (adminYear) {
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      const opt = document.createElement('option');
      opt.value = y; opt.textContent = y;
      if (y === currentYear) opt.selected = true;
      adminYear.appendChild(opt);
    }
  }
}

async function loadTeachers() {
  showLoading(true);
  const res = await callAPI('getTeachers');
  showLoading(false);
  if (res.success) {
    teachers = res.data || [];
    const select = document.getElementById('teacherSelect');
    select.innerHTML = '<option value="">-- เลือกครู --</option>';
    teachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.teacherId;
      opt.textContent = `${t.prefix}${t.fullName}`;
      select.appendChild(opt);
    });
    if (teachers.length > 0) {
      select.value = teachers[0].teacherId;
      await loadTeacherData();
    }
  }
}

async function loadIndicators() {
  const res = await callAPI('getIndicators');
  if (res.success) indicators = res.data || [];
}

async function loadTeacherData() {
  const teacherId = document.getElementById('teacherSelect').value;
  const year = document.getElementById('yearSelect').value;
  const round = document.getElementById('roundSelect').value;
  
  if (!teacherId) return;
  
  showLoading(true);
  const [profileRes, reportRes] = await Promise.all([
    callAPI('getTeacherProfile', { teacherId }),
    callAPI('getReport', { teacherId, fiscalYear: year, round })
  ]);
  showLoading(false);
  
  if (profileRes.success) {
    currentTeacher = profileRes.data;
    renderProfile();
  }
  
  if (reportRes.success) {
    currentReport = reportRes.data.reports || [];
    currentChallenge = reportRes.data.challenge || null;
    currentEthics = reportRes.data.ethics || [];
    renderIndicators();
    renderChallenge();
    renderEthics();
    renderSummary();
  }
}

function renderProfile() {
  const t = currentTeacher;
  document.getElementById('teacherName').textContent = `${t.prefix}${t.fullName}`;
  document.getElementById('teacherPosition').textContent = t.position;
  document.getElementById('teacherSchool').textContent = `${t.subject || ''} | ${t.school || ''}`;
  document.getElementById('teacherStatus').textContent = t.vitthayaStatus || 'ไม่ระบุวิทยฐานะ';
  document.getElementById('teacherPhoto').src = t.photoUrl || 'https://via.placeholder.com/80';
  document.getElementById('profileCard').classList.remove('skeleton');
}

function renderIndicators() {
  const container = document.getElementById('indicatorsList');
  container.innerHTML = '';
  
  const parts = [
    { no: 1, name: 'การจัดการเรียนรู้' },
    { no: 2, name: 'การส่งเสริมและสนับสนุนการจัดการเรียนรู้' },
    { no: 3, name: 'การพัฒนาตนเองและวิชาชีพ' }
  ];
  
  parts.forEach(part => {
    const partHeader = document.createElement('div');
    partHeader.className = 'part-header';
    partHeader.textContent = `ด้านที่ ${part.no} ${part.name}`;
    container.appendChild(partHeader);
    
    const partIndicators = indicators.filter(i => i.part == part.no).sort((a,b) => a.order - b.order);
    partIndicators.forEach(ind => {
      const report = currentReport.find(r => r.indicatorId == ind.indicatorId) || {};
      const score = report.selfScore || '';
      const scoreClass = score ? `score-${score}` : 'score-empty';
      const scoreText = score ? getScoreLabel(score) : 'ยังไม่ประเมิน';
      
      const card = document.createElement('div');
      card.className = 'indicator-card';
      card.innerHTML = `
        <div class="indicator-header">
          <div>
            <div class="indicator-code">${ind.code}</div>
            <div class="indicator-title">${ind.title}</div>
          </div>
          <span class="score-badge ${scoreClass}">${scoreText}</span>
        </div>
        <div class="indicator-desc">${report.description || 'ยังไม่มีคำอธิบายผลการปฏิบัติงาน'}</div>
        <div class="evidence-gallery" id="gallery-${ind.indicatorId}"></div>
      `;
      container.appendChild(card);
      
      // Evidence
      const gallery = card.querySelector(`#gallery-${ind.indicatorId}`);
      const links = safeParseJSON(report.evidenceLinks);
      if (links && links.length) {
        links.forEach(link => {
          const thumb = document.createElement('img');
          thumb.className = 'evidence-thumb';
          thumb.src = isImage(link) ? link : 'https://via.placeholder.com/70?text=FILE';
          thumb.onclick = () => openLightbox(link);
          gallery.appendChild(thumb);
        });
      } else {
        gallery.innerHTML = '<span style="color:var(--text-muted);font-size:0.85rem;">ไม่มีไฟล์แนบ</span>';
      }
    });
  });
  
  updateProgress();
}

function getScoreLabel(score) {
  const labels = { 1: 'ต่ำกว่าคาดหวังมาก', 2: 'ต่ำกว่าคาดหวัง', 3: 'ตามคาดหวัง', 4: 'สูงกว่าคาดหวัง' };
  return labels[score] || score;
}

function renderChallenge() {
  const container = document.getElementById('challengeContent');
  if (!currentChallenge) {
    container.innerHTML = '<p style="color:var(--text-muted)">ยังไม่มีข้อมูลประเด็นท้าทาย</p>';
    return;
  }
  container.innerHTML = `
    <div class="indicator-card">
      <div class="indicator-title">ประเด็นท้าทาย</div>
      <div class="indicator-desc">${currentChallenge.title || '-'}</div>
      <div class="indicator-title">วิธีดำเนินการ</div>
      <div class="indicator-desc">${currentChallenge.method || '-'}</div>
      <div class="indicator-title">ผลลัพธ์ที่คาดหวัง</div>
      <div class="indicator-desc">${currentChallenge.expectedOutcome || '-'}</div>
      <div class="indicator-title">คะแนน: ${currentChallenge.score || 0}/20</div>
    </div>
  `;
}

function renderEthics() {
  const container = document.getElementById('ethicsContent');
  if (!currentEthics.length) {
    container.innerHTML = '<p style="color:var(--text-muted)">ยังไม่มีข้อมูลจรรยาบรรณ</p>';
    return;
  }
  container.innerHTML = '';
  currentEthics.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'indicator-card';
    card.innerHTML = `
      <div class="indicator-header">
        <div>
          <div class="indicator-code">ข้อ ${item.itemNo || idx + 1}</div>
          <div class="indicator-title">${item.itemTitle}</div>
        </div>
        <span class="score-badge ${item.score >= 2 ? 'score-3' : 'score-1'}">${item.score || 0}/2</span>
      </div>
      <div class="indicator-desc">${item.note || ''}</div>
    `;
    container.appendChild(card);
  });
}

function renderSummary() {
  // Calculate scores
  let part1Score = 0, part1Max = 0;
  currentReport.forEach(r => {
    const ind = indicators.find(i => i.indicatorId == r.indicatorId);
    if (ind) {
      part1Max += 4;
      part1Score += parseInt(r.selfScore || 0);
    }
  });
  part1Score = part1Score / 4 * (60/15); // Convert to 60 points
  
  const challengeScore = parseFloat(currentChallenge?.score || 0);
  const ethicsScore = currentEthics.reduce((sum, e) => sum + parseFloat(e.score || 0), 0);
  const total = (part1Score || 0) + challengeScore + ethicsScore;
  const maxTotal = 100;
  const percent = Math.round((total / maxTotal) * 100);
  
  // Update radial
  const radial = document.getElementById('overallProgress');
  radial.style.background = `conic-gradient(var(--primary) ${percent * 3.6}deg, var(--border) 0deg)`;
  radial.querySelector('.progress-value').textContent = `${percent}%`;
  
  document.getElementById('part1Bar').style.width = `${Math.min((part1Score/60)*100, 100)}%`;
  document.getElementById('part2Bar').style.width = `${Math.min((challengeScore/20)*100, 100)}%`;
  document.getElementById('part3Bar').style.width = `${Math.min((ethicsScore/20)*100, 100)}%`;
  
  // Summary table
  document.getElementById('summaryTable').innerHTML = `
    <table>
      <tr><th>องค์ประกอบ</th><th>คะแนน</th><th>เต็ม</th></tr>
      <tr><td>องค์ประกอบที่ 1 ตอนที่ 1 (ตัวชี้วัด)</td><td>${part1Score.toFixed(2)}</td><td>60</td></tr>
      <tr><td>องค์ประกอบที่ 1 ตอนที่ 2 (ประเด็นท้าทาย)</td><td>${challengeScore}</td><td>20</td></tr>
      <tr><td>องค์ประกอบที่ 3 (จรรยาบรรณ)</td><td>${ethicsScore}</td><td>20</td></tr>
      <tr><td><strong>รวม</strong></td><td><strong>${total.toFixed(2)}</strong></td><td><strong>${maxTotal}</strong></td></tr>
    </table>
  `;
  
  drawChart(part1Score, challengeScore, ethicsScore);
}

function drawChart(p1, p2, p3) {
  const canvas = document.getElementById('summaryChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const labels = ['ตัวชี้วัด\n(60)', 'ประเด็นท้าทาย\n(20)', 'จรรยาบรรณ\n(20)'];
  const data = [p1, p2, p3];
  const max = [60, 20, 20];
  const colors = ['#4f46e5', '#7c3aed', '#06b6d4'];
  const barWidth = 60;
  const gap = 50;
  const startX = 50;
  const bottomY = 250;
  const chartHeight = 200;
  
  data.forEach((val, i) => {
    const h = (val / max[i]) * chartHeight;
    const x = startX + i * (barWidth + gap);
    const y = bottomY - h;
    
    ctx.fillStyle = colors[i];
    ctx.fillRect(x, y, barWidth, h);
    
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.font = '12px Sarabun';
    ctx.textAlign = 'center';
    ctx.fillText(val.toFixed(1), x + barWidth/2, y - 10);
    ctx.fillText(labels[i], x + barWidth/2, bottomY + 30);
  });
}

function updateProgress() {
  // Already handled in renderSummary
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `${tab}Tab`));
}

function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  lb.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch(e) { return []; }
}

function isImage(url) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}