const video = document.getElementById('webcam');
const canvas = document.getElementById('overlay-canvas');
const submitBtn = document.getElementById('btn-submit');
const instructionText = document.getElementById('scan-instruction');
const form = document.getElementById('register-form');

let localStream = null;
let currentDescriptor = null;
let currentSnapshot = null;
let detectionInterval = null;
let isRegistering = false;

// Initialization
window.addEventListener('load', async () => {
  // 1. Load Face API models
  const modelsLoaded = await loadFaceApiModels();
  if (!modelsLoaded) return;
  
  // 2. Start webcam
  await startWebcam();
  
  // 3. Start face detection loop
  startDetectionLoop();
  
  // Initialize role settings
  handleRoleChange();
});

// Start camera stream
async function startWebcam() {
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
    instructionText.innerText = 'Camera connected. Align your face.';
    
    // Play interaction sound
    playSound('click');
  } catch (err) {
    console.error('Webcam access failed:', err);
    instructionText.innerText = 'Failed to access camera.';
    showToast('Webcam access denied. Please allow camera permissions.', 'error');
  }
}

// Custom select role click handler
function selectRole(roleName) {
  playSound('click');
  
  // Update hidden field value
  document.getElementById('reg-role').value = roleName;
  
  // Update active border layout classes on cards
  const options = document.querySelectorAll('.category-option');
  options.forEach(opt => opt.classList.remove('active'));
  
  document.getElementById(`role-${roleName}`).classList.add('active');
  
  // Call role placeholder change
  handleRoleChange();
}

// Automatically change reasons placeholder based on role
function handleRoleChange() {
  const role = document.getElementById('reg-role').value;
  const flatInput = document.getElementById('reg-flat');
  const reasonLabel = document.getElementById('reason-label');
  const reasonInput = document.getElementById('reg-reason');
  const flatLabel = document.getElementById('flat-label');
  
  if (role === 'Resident') {
    flatInput.required = true;
    flatInput.placeholder = 'e.g. B-402 (Required)';
    flatLabel.innerText = 'Flat / Room No. (Required)';
    reasonLabel.innerText = 'Details / Vehicle Number';
    reasonInput.placeholder = 'e.g. Flat Owner, Parking Slot B2, Car No. MH-02-1234';
  } else if (role === 'Staff') {
    flatInput.required = false;
    flatInput.placeholder = 'e.g. Guard Post';
    flatLabel.innerText = 'Workstation Location';
    reasonLabel.innerText = 'Staff Designation';
    reasonInput.placeholder = 'e.g. Security Guard, Supervisor, Electrician';
  } else if (role === 'Delivery') {
    flatInput.required = false;
    flatInput.placeholder = 'Gate Entrance';
    flatLabel.innerText = 'Delivery Location';
    reasonLabel.innerText = 'Delivery Service Name';
    reasonInput.placeholder = 'e.g. Amazon, FedEx, Zomato, Swiggy';
  } else { // Visitor
    flatInput.required = false;
    flatInput.placeholder = 'e.g. A-301';
    flatLabel.innerText = 'Flat visiting';
    reasonLabel.innerText = 'Reason for Visiting';
    reasonInput.placeholder = 'e.g. Meeting friend, Repair service, Gas cylinder delivery';
  }
}

// Continuous Face Detection & Landmarks Extraction
function startDetectionLoop() {
  if (detectionInterval) clearInterval(detectionInterval);
  
  video.addEventListener('play', () => {
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);
  });
  
  detectionInterval = setInterval(async () => {
    if (!video.videoWidth || !video.videoHeight || isRegistering) return;
    
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    
    // Detect single face with landmarks & descriptor
    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
      
    // Clear canvas
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const cameraBox = document.getElementById('camera-box');
    
    if (detection) {
      // Draw detection borders
      const resizedDetection = faceapi.resizeResults(detection, displaySize);
      
      // Draw custom bounding box
      const box = resizedDetection.detection.box;
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#06b6d4';
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      
      // Reset shadow for landmarks
      ctx.shadowBlur = 0;
      
      // Draw landmarks
      faceapi.draw.drawFaceLandmarks(canvas, resizedDetection);
      
      // Save details
      currentDescriptor = Array.from(detection.descriptor);
      currentSnapshot = captureFaceSnapshot(video, detection.detection.box);
      
      // Enable Submit
      submitBtn.removeAttribute('disabled');
      instructionText.innerText = 'Face detected! Complete form details.';
      document.getElementById('pulse-dot').style.backgroundColor = 'var(--success)';
      cameraBox.classList.add('scanning');
    } else {
      currentDescriptor = null;
      submitBtn.setAttribute('disabled', 'true');
      instructionText.innerText = 'Align face in camera viewport...';
      document.getElementById('pulse-dot').style.backgroundColor = 'var(--accent-cyan)';
      cameraBox.classList.remove('scanning');
    }
  }, 250);
}

// Form Submission handling
async function handleRegistration(e) {
  e.preventDefault();
  
  if (isRegistering) return;
  if (!currentDescriptor || !currentSnapshot) {
    showToast('Face coordinates not captured yet.', 'warning');
    return;
  }
  
  const name = document.getElementById('reg-name').value.trim();
  const contact = document.getElementById('reg-contact').value.trim();
  const role = document.getElementById('reg-role').value;
  const flat = document.getElementById('reg-flat').value.trim();
  const reasonText = document.getElementById('reg-reason').value.trim();
  
  // Create unified reason: Flat - Reason
  const reason = flat ? `Flat ${flat} | ${reasonText || 'No details'}` : (reasonText || 'No details');
  
  isRegistering = true;
  submitBtn.setAttribute('disabled', 'true');
  submitBtn.innerText = 'Processing Enrollment...';
  
  // Flash camera border
  const cameraBox = document.getElementById('camera-box');
  cameraBox.classList.remove('scanning');
  cameraBox.classList.add('verified');
  
  try {
    const payload = {
      name,
      contact,
      role,
      reason,
      descriptor: currentDescriptor,
      photo: currentSnapshot
    };
    
    await apiCall('/members', 'POST', payload);
    
    // Play registration success beep
    playSound('success');
    showToast(`Successfully Enrolled: ${name}`, 'success');
    
    // Reset Form
    resetForm();
  } catch (error) {
    console.error('Registration failed:', error);
    cameraBox.classList.add('alerted');
    playSound('error');
    setTimeout(() => cameraBox.classList.remove('alerted'), 1000);
  } finally {
    isRegistering = false;
    submitBtn.innerText = 'Register Member';
    setTimeout(() => cameraBox.classList.remove('verified'), 1000);
  }
}

// Reset form values
function resetForm() {
  form.reset();
  currentDescriptor = null;
  currentSnapshot = null;
  submitBtn.setAttribute('disabled', 'true');
  
  // Reset active role cards to Visitor default
  selectRole('Visitor');
  
  // Reset overlay
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// Clean up stream on unload
window.addEventListener('beforeunload', () => {
  if (detectionInterval) clearInterval(detectionInterval);
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
});
