const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay-canvas');
const cameraBox = document.getElementById('camera-box');
const cameraStatus = document.getElementById('camera-status');
const instructionText = document.getElementById('scan-instruction');
const pulseDot = document.getElementById('pulse-dot');

// Diagnostic spans
const diagRes = document.getElementById('diag-res');
const diagLatency = document.getElementById('diag-latency');

// Status Panel Elements
const statusCard = document.getElementById('status-card');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');
const statusActionArea = document.getElementById('status-action-area');

const quickLogsContainer = document.getElementById('quick-logs');

// State Variables
let localStream = null;
let members = [];
let detectionInterval = null;
let lastLoggedUser = null;
let lastLogTime = 0;
const LOG_COOLDOWN_MS = 6000; // 6 seconds log cooldown for same face
const MATCH_THRESHOLD = 0.50; // Euclidean distance match threshold (lower = stricter)

// Initialize Audio Context on user gesture to avoid browser block
function initializeAudioContext() {
  playSound('click');
  showToast('Audio warning chimes activated', 'success');
}

// Initialization on load
window.addEventListener('load', async () => {
  // 1. Fetch registered members from local DB
  await fetchMembers();
  
  // 2. Load Face API models
  const modelsLoaded = await loadFaceApiModels();
  if (!modelsLoaded) return;
  
  // 3. Start camera feed
  await startWebcam();
  
  // 4. Load recent logs list
  await fetchRecentLogs();
  
  // 5. Start real-time recognition loop
  startRecognitionLoop();
});

// Fetch members list
async function fetchMembers() {
  try {
    members = await apiCall('/members');
    console.log(`Loaded ${members.length} registered members.`);
  } catch (err) {
    console.error('Failed to fetch members:', err);
    showToast('Failed to load registered members from local DB', 'error');
  }
}

// Start webcam stream
async function startWebcam() {
  if (cameraStatus) cameraStatus.innerText = 'Connecting camera...';
  instructionText.innerText = 'Connecting camera...';
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 640 }, 
        height: { ideal: 480 },
        facingMode: 'user'
      },
      audio: false
    });
    
    video.srcObject = stream;
    localStream = stream;
    if (cameraStatus) {
      cameraStatus.innerText = 'ONLINE';
      cameraStatus.style.color = 'var(--success)';
    }
    instructionText.innerText = 'System active. Look at camera...';
    
    // Read camera track specs for diagnostic info
    const track = stream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings();
      if (settings.width && settings.height) {
        diagRes.innerText = `${settings.width}x${settings.height}`;
      }
    }
  } catch (err) {
    console.error('Camera connection failed:', err);
    if (cameraStatus) {
      cameraStatus.innerText = 'OFFLINE';
      cameraStatus.style.color = 'var(--danger)';
    }
    instructionText.innerText = 'Camera access blocked.';
    showToast('Could not access camera. Grant permissions.', 'error');
  }
}

// Euclidean distance calculation between two 128-dimensional vectors
function getEuclideanDistance(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// Find closest matching registered face
function findBestMatch(faceDescriptor) {
  if (members.length === 0) return { matched: false, distance: Infinity, member: null };
  
  let bestMatch = null;
  let minDistance = Infinity;
  
  for (const member of members) {
    const distance = getEuclideanDistance(faceDescriptor, member.descriptor);
    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = member;
    }
  }
  
  const matched = minDistance < MATCH_THRESHOLD;
  return { matched, distance: minDistance, member: matched ? bestMatch : null };
}

// Recognition Engine Loop
function startRecognitionLoop() {
  if (detectionInterval) clearInterval(detectionInterval);
  
  video.addEventListener('play', () => {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
  });

  detectionInterval = setInterval(async () => {
    if (!video.videoWidth || !video.videoHeight) return;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    // Performance timer
    const t0 = performance.now();
    
    // Detect single face
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
      
    // Write latency measurement
    const latency = Math.round(performance.now() - t0);
    diagLatency.innerText = `${latency}ms`;
      
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const now = Date.now();
    
    if (detection) {
      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      const box = resizedDetection.detection.box;
      
      // Look up match
      const descriptor = Array.from(detection.descriptor);
      const matchResult = findBestMatch(descriptor);
      
      // Determine glow colors based on match
      let boxColor = '#ef4444'; // Red for unknown
      if (matchResult.matched) {
        boxColor = '#10b981'; // Green for residents/staff
        if (matchResult.member.role === 'Visitor') {
          boxColor = '#f59e0b'; // Amber for visitors
        }
      }
      
      // Draw dynamic face border
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Draw landmarks
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
      
      // Handle Logging and Status displays
      if (matchResult.matched) {
        const member = matchResult.member;
        
        // Render Access Granted state
        renderGrantedState(member);
        
        // Log event if cooldown passed or different user
        if (lastLoggedUser !== member.id || (now - lastLogTime) > LOG_COOLDOWN_MS) {
          const snapshot = captureFaceSnapshot(video, detection.detection.box);
          await logScanEvent({
            memberId: member.id,
            name: member.name,
            role: member.role,
            contact: member.contact,
            reason: member.reason,
            photo: snapshot,
            status: 'Access Granted'
          });
          
          lastLoggedUser = member.id;
          lastLogTime = now;
        }
      } else {
        // Unrecognized Face (Access Denied)
        renderDeniedState();
        
        // Log event for Unknown if cooldown passed
        if (lastLoggedUser !== 'unknown' || (now - lastLogTime) > LOG_COOLDOWN_MS) {
          const snapshot = captureFaceSnapshot(video, detection.detection.box);
          await logScanEvent({
            memberId: null,
            name: 'Unknown Face',
            role: 'Unknown',
            contact: 'N/A',
            reason: 'Unregistered face scanned at gate entry point',
            photo: snapshot,
            status: 'Access Denied'
          });
          
          lastLoggedUser = 'unknown';
          lastLogTime = now;
        }
      }
    } else {
      // No face detected - return to Idle scanner state after a small delay
      if (now - lastLogTime > 2500) {
        renderIdleState();
      }
    }
  }, 300);
}

// Log event helper to Backend
async function logScanEvent(logPayload) {
  try {
    await apiCall('/logs', 'POST', logPayload);
    fetchRecentLogs();
  } catch (err) {
    console.error('Error logging scan event:', err);
  }
}

// Fetch recent entry logs
async function fetchRecentLogs() {
  try {
    const logs = await apiCall('/logs');
    if (!logs || logs.length === 0) {
      quickLogsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          </div>
          <h5>No entry logs recorded</h5>
          <p>Scanner logs will appear here in real time.</p>
        </div>`;
      return;
    }
    
    // Display top 4 recent logs
    const recent = logs.slice(0, 4);
    
    quickLogsContainer.innerHTML = recent.map(log => {
      const isGranted = log.status === 'Access Granted' || log.status === 'Registered';
      const statusClass = isGranted ? 'status-text-granted' : 'status-text-denied';
      const photoSrc = log.photo || 'https://via.placeholder.com/36';
      
      let badgeClass = 'badge-unknown';
      if (log.role === 'Resident') badgeClass = 'badge-resident';
      if (log.role === 'Visitor') badgeClass = 'badge-visitor';
      if (log.role === 'Staff') badgeClass = 'badge-staff';
      if (log.role === 'Delivery') badgeClass = 'badge-delivery';

      return `
        <div class="quick-log-card">
          <img src="${photoSrc}" class="quick-log-img" alt="Scan Thumbnail">
          <div class="quick-log-info">
            <div class="quick-log-name">${log.name}</div>
            <div class="quick-log-role-time">
              <span class="badge ${badgeClass}" style="transform: scale(0.85); transform-origin: left; padding: 0.1rem 0.35rem; font-size: 0.6rem;">${log.role}</span>
              <span class="quick-log-time">${formatTime(log.timestamp)}</span>
            </div>
          </div>
          <div class="${statusClass}">
            ${isGranted ? 'GRANTED' : 'DENIED'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading recent logs:', err);
  }
}

// UI Rendering States (Replaced Emojis with crisp inline SVG graphics)
function renderIdleState() {
  cameraBox.className = 'webcam-panel';
  statusCard.className = 'verification-card ready';
  
  // Replace status avatar/image back to loupe icon
  const currentIcon = document.getElementById('status-icon');
  if (currentIcon) {
    currentIcon.outerHTML = `
      <div class="status-symbol" id="status-icon">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
    `;
  }
  
  statusTitle.innerText = 'System Standby';
  statusDesc.innerText = 'Awaiting face alignment in the security viewport...';
  statusActionArea.innerHTML = '';
  
  instructionText.innerText = 'Position face in frame...';
  pulseDot.style.backgroundColor = 'var(--accent-cyan)';
}

function renderGrantedState(member) {
  cameraBox.className = 'webcam-panel scanning verified';
  statusCard.className = 'verification-card granted';
  
  let badgeClass = 'badge-visitor';
  if (member.role === 'Resident') badgeClass = 'badge-resident';
  if (member.role === 'Staff') badgeClass = 'badge-staff';
  if (member.role === 'Delivery') badgeClass = 'badge-delivery';

  const memberPhoto = member.photo || 'https://via.placeholder.com/80';

  const currentIcon = document.getElementById('status-icon');
  if (currentIcon) {
    currentIcon.outerHTML = `<img id="status-icon" src="${memberPhoto}" class="status-avatar" alt="Face Avatar">`;
  }
  
  statusTitle.innerHTML = `<span class="badge ${badgeClass}">${member.role}</span><br>${member.name}`;
  statusDesc.innerHTML = `
    <strong>ID:</strong> ${member.id} | <strong>Phone:</strong> ${member.contact}<br>
    <strong>Details:</strong> ${member.reason}
  `;
  
  statusActionArea.innerHTML = `
    <div style="color: var(--success); font-weight: 700; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 0.5rem; letter-spacing: 0.2px;">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2.5;"><polyline points="20 6 9 17 4 12"/></svg>
      ACCESS GRANTED - OPENING GATE
    </div>
  `;
  
  instructionText.innerText = `Access Granted: ${member.name}`;
  pulseDot.style.backgroundColor = 'var(--success)';
  
  if (lastLoggedUser !== member.id) {
    cameraBox.classList.add('success-flash');
    playSound('success');
    setTimeout(() => cameraBox.classList.remove('success-flash'), 1000);
  }
}

function renderDeniedState() {
  cameraBox.className = 'webcam-panel scanning alerted';
  statusCard.className = 'verification-card denied';
  
  const currentIcon = document.getElementById('status-icon');
  if (currentIcon) {
    currentIcon.outerHTML = `
      <div class="status-symbol" id="status-icon">
        <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
    `;
  }
  
  statusTitle.innerHTML = `<span class="badge badge-unknown">UNKNOWN</span><br>Access Restricted`;
  statusDesc.innerText = 'Unregistered face detected at entry point. Verify credentials or register visitor.';
  
  statusActionArea.innerHTML = `
    <a href="register.html" class="btn" style="margin-top: 0.5rem; text-decoration: none; font-size: 0.8rem; padding: 0.55rem 1.1rem; gap:0.4rem;">
      <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
      Register Visitor
    </a>
  `;
  
  instructionText.innerText = 'ACCESS RESTRICTED: UNKNOWN';
  pulseDot.style.backgroundColor = 'var(--danger)';
  
  if (lastLoggedUser !== 'unknown') {
    cameraBox.classList.add('error-flash');
    playSound('error');
    setTimeout(() => cameraBox.classList.remove('error-flash'), 1000);
  }
}

// Clean up stream on unload
window.addEventListener('beforeunload', () => {
  if (detectionInterval) clearInterval(detectionInterval);
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
});
