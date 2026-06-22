let currentActiveTab = 'logs';
let dashboardPollInterval = null;
let registeredMembersCache = [];

// DOM Elements
const logsTableBody = document.getElementById('logs-table-body');
const membersTableBody = document.getElementById('members-table-body');
const searchInput = document.getElementById('member-search');
const lastUpdatedSpan = document.getElementById('last-updated');

// Modal Elements
const photoModal = document.getElementById('photo-modal');
const modalImg = document.getElementById('modal-img');
const modalTitle = document.getElementById('modal-title');
const modalDetails = document.getElementById('modal-details');

// Stats Counters
const countTotal = document.getElementById('stat-total-members');
const countResidents = document.getElementById('stat-residents');
const countVisitors = document.getElementById('stat-visitors-today');
const countDeliveries = document.getElementById('stat-deliveries');
const countAlerts = document.getElementById('stat-alerts');

// Initialize
window.addEventListener('load', () => {
  refreshDashboardData();
  
  // Start background auto-poll (every 3 seconds) for live logs update
  startAutoPoll();
});

// Tab switcher
function switchTab(tabName) {
  currentActiveTab = tabName;
  playSound('click');
  
  // Toggle buttons
  document.getElementById('tab-logs-btn').classList.toggle('active', tabName === 'logs');
  document.getElementById('tab-members-btn').classList.toggle('active', tabName === 'members');
  
  // Toggle contents
  document.getElementById('tab-logs').classList.toggle('active', tabName === 'logs');
  document.getElementById('tab-members').classList.toggle('active', tabName === 'members');
  
  // Run specific view fetchers
  if (tabName === 'members') {
    loadMembersDirectory();
  } else {
    loadLogsView();
  }
}

// Fetch all stats and logs/members
async function refreshDashboardData() {
  await fetchDashboardStats();
  if (currentActiveTab === 'logs') {
    await loadLogsView();
  } else {
    await loadMembersDirectory();
  }
  showToast('Dashboard details synced', 'success');
}

// Auto-polling for live logs
function startAutoPoll() {
  if (dashboardPollInterval) clearInterval(dashboardPollInterval);
  
  dashboardPollInterval = setInterval(async () => {
    if (currentActiveTab === 'logs') {
      await fetchDashboardStats();
      await loadLogsView(true); // silent update
    }
  }, 3000);
}

// Fetch stats and update counters
async function fetchDashboardStats() {
  try {
    const stats = await apiCall('/stats');
    
    // Animate numbers
    animateNumber(countTotal, stats.totalMembers);
    animateNumber(countResidents, stats.residentsCount);
    animateNumber(countVisitors, stats.activeVisitorsToday);
    animateNumber(countDeliveries, stats.deliveryEntriesToday);
    animateNumber(countAlerts, stats.alertsToday);
    
    lastUpdatedSpan.innerText = `Last update: ${formatTime(new Date())}`;
  } catch (err) {
    console.error('Failed to load dashboard metrics:', err);
  }
}

// Animate numbers helper
function animateNumber(element, finalVal) {
  const currentVal = parseInt(element.innerText) || 0;
  if (currentVal === finalVal) return;
  
  let start = currentVal;
  const duration = 400; // ms
  const stepTime = 25;
  const steps = duration / stepTime;
  const increment = (finalVal - currentVal) / steps;
  
  let step = 0;
  const timer = setInterval(() => {
    start += increment;
    element.innerText = Math.round(start);
    step++;
    if (step >= steps) {
      clearInterval(timer);
      element.innerText = finalVal;
    }
  }, stepTime);
}

// Load logs into table
async function loadLogsView(silent = false) {
  try {
    const logs = await apiCall('/logs');
    
    if (!logs || logs.length === 0) {
      logsTableBody.innerHTML = `
        <tr>
          <td colspan="7">
            <div class="empty-state">
              <div class="empty-state-icon">
                <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <h5>No entry logs available</h5>
              <p>Entrance scanner events will appear here.</p>
            </div>
          </td>
        </tr>`;
      return;
    }
    
    logsTableBody.innerHTML = logs.map(log => {
      const isGranted = log.status === 'Access Granted' || log.status === 'Registered';
      const statusClass = isGranted ? 'status-text-granted' : 'status-text-denied';
      const photoSrc = log.photo || 'https://via.placeholder.com/38';
      
      let badgeClass = 'badge-unknown';
      if (log.role === 'Resident') badgeClass = 'badge-resident';
      if (log.role === 'Visitor') badgeClass = 'badge-visitor';
      if (log.role === 'Staff') badgeClass = 'badge-staff';
      if (log.role === 'Delivery') badgeClass = 'badge-delivery';

      const detailsEscaped = `${log.name} (${log.role})`;
      const descSnippet = `${log.name} verified at ${formatTime(log.timestamp)}.`;

      return `
        <tr>
          <td>
            <img src="${photoSrc}" class="table-avatar" alt="Face" 
                 onclick="openPhotoModal('${photoSrc}', '${detailsEscaped}', '${log.reason}')" 
                 style="cursor: pointer; transition: opacity var(--transition-speed);" 
                 onmouseover="this.style.opacity='0.8'" 
                 onmouseout="this.style.opacity='1'">
          </td>
          <td>
            <div class="table-user-name">${log.name}</div>
            <div class="table-user-id">ID: ${log.memberId || 'Guest'}</div>
          </td>
          <td>
            <span class="badge ${badgeClass}">${log.role}</span>
          </td>
          <td class="table-phone">${log.contact}</td>
          <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.reason}">
            ${log.reason}
          </td>
          <td>
            <div class="table-time">${formatTime(log.timestamp)}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top:0.1rem;">${formatDate(log.timestamp)}</div>
          </td>
          <td class="${statusClass}">
            ${log.status.toUpperCase()}
          </td>
        </tr>
      `;
    }).join('');
    
  } catch (err) {
    console.error('Error rendering logs:', err);
  }
}

// Load registered members into directory
async function loadMembersDirectory() {
  try {
    const members = await apiCall('/members');
    registeredMembersCache = members;
    renderMembersTable(members);
  } catch (err) {
    console.error('Error rendering members directory:', err);
  }
}

// Render members table
function renderMembersTable(membersList) {
  if (!membersList || membersList.length === 0) {
    membersTableBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <h5>No registered members found</h5>
            <p>Enroll new members on the Register Face screen.</p>
          </div>
        </td>
      </tr>`;
    return;
  }
  
  membersTableBody.innerHTML = membersList.map(member => {
    const photoSrc = member.photo || 'https://via.placeholder.com/38';
    
    let badgeClass = 'badge-unknown';
    if (member.role === 'Resident') badgeClass = 'badge-resident';
    if (member.role === 'Visitor') badgeClass = 'badge-visitor';
    if (member.role === 'Staff') badgeClass = 'badge-staff';
    if (member.role === 'Delivery') badgeClass = 'badge-delivery';

    const detailsEscaped = `${member.name} (${member.role})`;

    return `
      <tr>
        <td>
          <img src="${photoSrc}" class="table-avatar" alt="Profile" 
               onclick="openPhotoModal('${photoSrc}', '${detailsEscaped}', '${member.reason}')" 
               style="cursor: pointer; transition: opacity var(--transition-speed);" 
               onmouseover="this.style.opacity='0.8'" 
               onmouseout="this.style.opacity='1'">
        </td>
        <td>
          <div class="table-user-name">${member.name}</div>
          <div class="table-user-id">ID: ${member.id}</div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${member.role}</span>
        </td>
        <td class="table-phone">${member.contact}</td>
        <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${member.reason}">
          ${member.reason}
        </td>
        <td class="table-time">${formatDate(member.createdAt)}</td>
        <td>
          <button class="btn btn-danger btn-secondary" onclick="deleteMember('${member.id}', '${member.name}')" 
                  style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 6px;">
            Unregister
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter members by search input
function filterMembers() {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    renderMembersTable(registeredMembersCache);
    return;
  }
  
  const filtered = registeredMembersCache.filter(m => {
    return m.name.toLowerCase().includes(query) || 
           m.contact.includes(query) || 
           m.role.toLowerCase().includes(query) ||
           m.reason.toLowerCase().includes(query);
  });
  
  renderMembersTable(filtered);
}

// Delete single member
async function deleteMember(id, name) {
  if (!confirm(`Are you sure you want to unregister and remove all face details for: ${name}?`)) {
    return;
  }
  
  playSound('click');
  try {
    await apiCall(`/members/${id}`, 'DELETE');
    showToast(`Unregistered: ${name}`, 'success');
    
    // Refresh
    await fetchDashboardStats();
    await loadMembersDirectory();
  } catch (err) {
    console.error('Failed to unregister member:', err);
  }
}

// Clear all logs
async function confirmClearLogs() {
  if (!confirm('Warning: This will delete ALL entrance activity logs permanently. Do you wish to proceed?')) {
    return;
  }
  
  playSound('click');
  try {
    await apiCall('/logs', 'DELETE');
    showToast('All entry logs cleared', 'success');
    
    // Refresh
    await fetchDashboardStats();
    await loadLogsView();
  } catch (err) {
    console.error('Failed to clear logs:', err);
  }
}

// Photo Viewer Modal helpers
function openPhotoModal(imgSrc, titleText, reasonText) {
  playSound('click');
  modalImg.src = imgSrc;
  modalTitle.innerText = titleText;
  modalDetails.innerHTML = `<strong>Registration Details / Credentials:</strong><br>${reasonText}`;
  photoModal.style.display = 'flex';
}

function closeModal() {
  photoModal.style.display = 'none';
}

// Close modal on escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// Clean up background timers
window.addEventListener('beforeunload', () => {
  if (dashboardPollInterval) clearInterval(dashboardPollInterval);
});
