let adminToken = localStorage.getItem('pa-admin-token');
let currentAdmin = null;
let allTeachers = [];
let allIndicators = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (adminToken) {
    await validateSession();
  } else {
    showLogin();
  }
  
  // Login form
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Sidebar nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });
  
  // Teacher search
  document.getElementById('teacherSearch')?.addEventListener('input', filterTeachers);
  
  // Teacher form
  document.getElementById('teacherForm')?.addEventListener('submit', saveTeacher);
  
  // File drag drop
  initFileDrop();
  
  // Admin selects
  document.getElementById('adminTeacherSelect')?.addEventListener('change', loadAdminReport);
  document.getElementById('adminYearSelect')?.addEventListener('change', loadAdminReport);
  document.getElementById('adminRoundSelect')?.addEventListener('change', loadAdminReport);
});

async function validateSession() {
  // In real implementation, verify token with server
  // For now, check localStorage and show dashboard
  currentAdmin = JSON.parse(localStorage.getItem('pa-admin-user') || '{}');
  showDashboard();
  await loadAdminData();
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('adminApp').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('adminApp').classList.remove('hidden');
  document.getElementById('adminName').textContent = currentAdmin.displayName || 'Admin';
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  const res = await callAPI('adminLogin', { username, password });
  if (res.success) {
    adminToken = res.data.token;
    currentAdmin = res.data;
    localStorage.setItem('pa-admin-token', adminToken);
    localStorage.setItem('pa-admin-user', JSON.stringify(currentAdmin));
    if (document.getElementById('rememberMe').checked) {
      localStorage.setItem('pa-remember-user', username);
    }
    showDashboard();
    await loadAdminData();
  } else {
    document.getElementById('loginError').textContent = res.message || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
  }
}

function logout() {
  localStorage.removeItem('pa-admin-token');
  localStorage.removeItem('pa-admin-user');
  adminToken = null;
  currentAdmin = null;
  showLogin();
}

function switchPage(page) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.admin-page').forEach(p => p.classList.toggle('active', p.id === `${page}Page`));
  
  if (page === 'teachers') renderTeachersTable();
  if (page === 'files') loadFiles();
  if (page === 'admins') loadAdmins();
  if (page === 'logs') loadLogs();
}

async function loadAdminData() {
  showLoading(true);
  const [teachersRes, indicatorsRes, summaryRes] = await Promise.all([
    callAPI('getTeachers'),
    callAPI('getIndicators'),
    callAPI('getDashboardSummary')
  ]);
  showLoading(false);
  
  if (teachersRes.success) {
    allTeachers = teachersRes.data || [];
    populateTeacherSelects();
    renderTeachersTable();
  }
  if (indicatorsRes.success) allIndicators = indicatorsRes.data || [];
  if (summaryRes.success) renderDashboard(summaryRes.data);
}

function renderDashboard(data) {
  document.getElementById('totalTeachers').textContent = data.totalTeachers || 0;
  document.getElementById('avgProgress').textContent = `${data.avgProgress || 0}%`;
  document.getElementById('totalFiles').textContent = data.totalFiles || 0;
  
  // Draw bar chart
  const canvas = document.getElementById('dashboardChart');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const teachers = data.teacherProgress || [];
  const barWidth = canvas.width / (teachers.length * 1.5);
  
  teachers.forEach((t, i) => {
    const h = (t.progress / 100) * 200;
    const x = i * barWidth * 1.5 + 20;
    const y = 250 - h;
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(x, y, barWidth, h);
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.font = '10px Sarabun';
    ctx.save();
    ctx.translate(x + barWidth/2, 270);
    ctx.rotate(-Math.PI/4);
    ctx.fillText(t.name, 0, 0);
    ctx.restore();
  });
}

function populateTeacherSelects() {
  const selects = [document.getElementById('adminTeacherSelect')];
  selects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">-- เลือกครู --</option>';
    allTeachers.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.teacherId;
      opt.textContent = `${t.prefix}${t.fullName}`;
      select.appendChild(opt);
    });
  });
}

function renderTeachersTable() {
  const container = document.getElementById('teachersTable');
  const search = document.getElementById('teacherSearch')?.value.toLowerCase() || '';
  const filtered = allTeachers.filter(t => 
    `${t.prefix}${t.fullName}`.toLowerCase().includes(search) ||
    (t.position || '').toLowerCase().includes(search)
  );
  
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>รูป</th>
          <th>ชื่อ-สกุล</th>
          <th>ตำแหน่ง</th>
          <th>โรงเรียน</th>
          <th>จัดการ</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(t => `
          <tr>
            <td><img src="${t.photoUrl || 'https://via.placeholder.com/40'}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
            <td>${t.prefix}${t.fullName}</td>
            <td>${t.position || ''}</td>
            <td>${t.school || ''}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editTeacher('${t.teacherId}')">แก้ไข</button>
              <button class="btn btn-sm btn-danger" onclick="deleteTeacher('${t.teacherId}')">ลบ</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterTeachers() { renderTeachersTable(); }

function openTeacherModal() {
  document.getElementById('teacherForm').reset();
  document.getElementById('editTeacherId').value = '';
  document.getElementById('teacherModalTitle').textContent = 'เพิ่มข้อมูลครู';
  document.getElementById('teacherModal').classList.add('active');
}

function closeTeacherModal() {
  document.getElementById('teacherModal').classList.remove('active');
}

async function saveTeacher(e) {
  e.preventDefault();
  const teacherId = document.getElementById('editTeacherId').value;
  const payload = {
    token: adminToken,
    prefix: document.getElementById('teacherPrefix').value,
    fullName: document.getElementById('teacherFullName').value,
    position: document.getElementById('teacherPosition').value,
    subject: document.getElementById('teacherSubject').value,
    school: document.getElementById('teacherSchool').value,
    vitthayaStatus: document.getElementById('teacherStatus').value,
    photoUrl: document.getElementById('teacherPhotoUrl').value
  };
  
  const fileInput = document.getElementById('teacherPhotoFile');
  if (fileInput.files[0]) {
    const uploadRes = await uploadFileToDrive(fileInput.files[0], 'teacher');
    if (uploadRes.success) payload.photoUrl = uploadRes.data.url;
  }
  
  const action = teacherId ? 'updateTeacher' : 'addTeacher';
  if (teacherId) payload.teacherId = teacherId;
  
  const res = await callAPI(action, payload);
  if (res.success) {
    closeTeacherModal();
    await loadAdminData();
    alert('บันทึกสำเร็จ');
  } else {
    alert(res.message || 'เกิดข้อผิดพลาด');
  }
}

function editTeacher(teacherId) {
  const t = allTeachers.find(x => x.teacherId === teacherId);
  if (!t) return;
  document.getElementById('editTeacherId').value = t.teacherId;
  document.getElementById('teacherPrefix').value = t.prefix || '';
  document.getElementById('teacherFullName').value = t.fullName || '';
  document.getElementById('teacherPosition').value = t.position || '';
  document.getElementById('teacherSubject').value = t.subject || '';
  document.getElementById('teacherSchool').value = t.school || '';
  document.getElementById('teacherStatus').value = t.vitthayaStatus || '';
  document.getElementById('teacherPhotoUrl').value = t.photoUrl || '';
  document.getElementById('teacherModalTitle').textContent = 'แก้ไขข้อมูลครู';
  document.getElementById('teacherModal').classList.add('active');
}

async function deleteTeacher(teacherId) {
  if (!confirm('ยืนยันการลบ?')) return;
  const res = await callAPI('deleteTeacher', { token: adminToken, teacherId });
  if (res.success) {
    await loadAdminData();
  } else {
    alert(res.message || 'เกิดข้อผิดพลาด');
  }
}

async function loadAdminReport() {
  const teacherId = document.getElementById('adminTeacherSelect').value;
  const year = document.getElementById('adminYearSelect').value;
  const round = document.getElementById('adminRoundSelect').value;
  if (!teacherId) return;
  
  const res = await callAPI('getReport', { teacherId, fiscalYear: year, round });
  const container = document.getElementById('adminIndicatorsList');
  container.innerHTML = '';
  
  if (!res.success) {
    container.innerHTML = '<p class="error">ไม่สามารถโหลดข้อมูลได้</p>';
    return;
  }
  
  const reports = res.data.reports || [];
  const challenge = res.data.challenge || {};
  const ethics = res.data.ethics || [];
  
  // Indicators form
  allIndicators.forEach(ind => {
    const report = reports.find(r => r.indicatorId == ind.indicatorId) || {};
    const section = document.createElement('div');
    section.className = 'indicator-card';
    section.innerHTML = `
      <div class="indicator-title">${ind.code} ${ind.title}</div>
      <textarea class="form-control" id="desc-${ind.indicatorId}" rows="3" placeholder="คำอธิบายผลการปฏิบัติงาน">${report.description || ''}</textarea>
      <div class="form-row" style="margin-top:0.75rem;">
        <div class="form-group">
          <label>ระดับคะแนน (1-4)</label>
          <select class="form-control" id="score-${ind.indicatorId}">
            <option value="">เลือก</option>
            <option value="1" ${report.selfScore == 1 ? 'selected' : ''}>1 - ต่ำกว่าคาดหวังมาก</option>
            <option value="2" ${report.selfScore == 2 ? 'selected' : ''}>2 - ต่ำกว่าคาดหวัง</option>
            <option value="3" ${report.selfScore == 3 ? 'selected' : ''}>3 - ตามคาดหวัง</option>
            <option value="4" ${report.selfScore == 4 ? 'selected' : ''}>4 - สูงกว่าคาดหวัง</option>
          </select>
        </div>
        <div class="form-group">
          <label>คะแนนผู้บังคับบัญชา (1-4)</label>
          <select class="form-control" id="super-${ind.indicatorId}">
            <option value="">เลือก</option>
            <option value="1" ${report.supervisorScore == 1 ? 'selected' : ''}>1</option>
            <option value="2" ${report.supervisorScore == 2 ? 'selected' : ''}>2</option>
            <option value="3" ${report.supervisorScore == 3 ? 'selected' : ''}>3</option>
            <option value="4" ${report.supervisorScore == 4 ? 'selected' : ''}>4</option>
          </select>
        </div>
      </div>
      <div class="evidence-gallery" id="admin-gallery-${ind.indicatorId}"></div>
      <input type="file" class="form-control" style="margin-top:0.75rem;" multiple 
        onchange="uploadEvidence('${ind.indicatorId}', this.files)" accept="image/*,application/pdf">
    `;
    container.appendChild(section);
  });
  
  // Challenge form
  const challengeSection = document.createElement('div');
  challengeSection.className = 'section-card';
  challengeSection.innerHTML = `
    <h3>ประเด็นท้าทาย (20 คะแนน)</h3>
    <div class="form-group"><label>ประเด็นท้าทาย</label><textarea class="form-control" id="challengeTitle" rows="2">${challenge.title || ''}</textarea></div>
    <div class="form-group"><label>วิธีดำเนินการ</label><textarea class="form-control" id="challengeMethod" rows="2">${challenge.method || ''}</textarea></div>
    <div class="form-group"><label>ผลลัพธ์ที่คาดหวัง</label><textarea class="form-control" id="challengeOutcome" rows="2">${challenge.expectedOutcome || ''}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>คะแนน (0-20)</label><input type="number" class="form-control" id="challengeScore" value="${challenge.score || ''}" min="0" max="20"></div>
    </div>
  `;
  container.appendChild(challengeSection);
  
  // Ethics form
  const ethicsSection = document.createElement('div');
  ethicsSection.className = 'section-card';
  ethicsSection.innerHTML = `<h3>จรรยาบรรณวิชาชีพ (20 คะแนน)</h3>`;
  ethics.forEach(item => {
    ethicsSection.innerHTML += `
      <div class="indicator-card">
        <div class="indicator-title">ข้อ ${item.itemNo} ${item.itemTitle}</div>
        <div class="form-row">
          <div class="form-group"><label>คะแนน (0-2)</label>
            <select class="form-control" id="ethics-${item.ethicsId}">
              <option value="0" ${item.score == 0 ? 'selected' : ''}>0</option>
              <option value="1" ${item.score == 1 ? 'selected' : ''}>1</option>
              <option value="2" ${item.score == 2 ? 'selected' : ''}>2</option>
            </select>
          </div>
        </div>
        <textarea class="form-control" id="ethics-note-${item.ethicsId}" rows="2" placeholder="หมายเหตุ">${item.note || ''}</textarea>
      </div>
    `;
  });
  container.appendChild(ethicsSection);
  
  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = '💾 บันทึกรายงานทั้งหมด';
  saveBtn.onclick = saveAdminReport;
  container.appendChild(saveBtn);
}

async function saveAdminReport() {
  const teacherId = document.getElementById('adminTeacherSelect').value;
  const year = document.getElementById('adminYearSelect').value;
  const round = document.getElementById('adminRoundSelect').value;
  
  // Save indicators
  for (const ind of allIndicators) {
    const payload = {
      token: adminToken,
      teacherId,
      fiscalYear: year,
      round,
      indicatorId: ind.indicatorId,
      description: document.getElementById(`desc-${ind.indicatorId}`).value,
      selfScore: document.getElementById(`score-${ind.indicatorId}`).value,
      supervisorScore: document.getElementById(`super-${ind.indicatorId}`).value,
      status: 'completed'
    };
    await callAPI('saveReport', payload);
  }
  
  // Save challenge
  await callAPI('saveChallenge', {
    token: adminToken,
    teacherId,
    fiscalYear: year,
    title: document.getElementById('challengeTitle').value,
    method: document.getElementById('challengeMethod').value,
    expectedOutcome: document.getElementById('challengeOutcome').value,
    score: document.getElementById('challengeScore').value
  });
  
  alert('บันทึกรายงานสำเร็จ');
}

async function uploadEvidence(indicatorId, files) {
  const teacherId = document.getElementById('adminTeacherSelect').value;
  const year = document.getElementById('adminYearSelect').value;
  const round = document.getElementById('adminRoundSelect').value;
  
  for (const file of files) {
    if (!validateFile(file)) continue;
    const res = await uploadFileToDrive(file, `${teacherId}/${year}/${round}/${indicatorId}`);
    if (res.success) {
      // Attach file to report
      await callAPI('saveReport', {
        token: adminToken,
        teacherId,
        fiscalYear: year,
        round,
        indicatorId,
        addEvidence: res.data.url
      });
    }
  }
  await loadAdminReport();
}

async function uploadFileToDrive(file, folderPath) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const res = await callAPI('uploadFile', {
        filename: file.name,
        mimeType: file.type,
        base64: base64,
        folderPath: folderPath
      });
      resolve(res);
    };
    reader.readAsDataURL(file);
  });
}

function validateFile(file) {
  if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
    alert(`ไฟล์ ${file.name} ใหญ่เกิน ${CONFIG.MAX_FILE_SIZE_MB} MB`);
    return false;
  }
  if (!CONFIG.ALLOWED_TYPES.includes(file.type)) {
    alert(`ไฟล์ ${file.name} ไม่รองรับประเภทนี้`);
    return false;
  }
  return true;
}

function initFileDrop() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  if (!dropZone) return;
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
}

function handleFiles(files) {
  const preview = document.getElementById('filePreview');
  preview.innerHTML = '';
  Array.from(files).forEach(file => {
    if (!validateFile(file)) return;
    const div = document.createElement('div');
    div.className = 'preview-item';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    div.appendChild(img);
    preview.appendChild(div);
  });
}

async function loadFiles() {
  // Implementation for file management
}

async function loadAdmins() {
  // Implementation for admin management
}

async function loadLogs() {
  const res = await callAPI('getLogs', { token: adminToken });
  const container = document.getElementById('logsTable');
  if (!res.success) {
    container.innerHTML = '<p>ไม่สามารถโหลดประวัติได้</p>';
    return;
  }
  container.innerHTML = `
    <table>
      <thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
      <tbody>
        ${(res.data || []).map(log => `
          <tr>
            <td>${log.timestamp}</td>
            <td>${log.actor}</td>
            <td>${log.action}</td>
            <td>${log.detail}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showLoading(show) {
  document.getElementById('loadingOverlay').classList.toggle('active', show);
}