// Shared configuration and helpers for the Society Face Recognition System
const API_BASE = '/api';

// Loading states
let modelsLoaded = false;

// Display a premium toast notification
function showToast(message, type = 'info') {
  // Check if a toast already exists, remove it
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  document.body.appendChild(toast);
  
  // Trigger transition
  setTimeout(() => toast.classList.add('show'), 50);
  
  // Auto dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// Generate synthesizer sound alerts using the Web Audio API (zero asset dependency)
function playSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    if (type === 'success') {
      // Access Granted sound: two rising synth chimes
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
      
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'error') {
      // Access Denied sound: a short buzzy low error tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      
      osc.frequency.setValueAtTime(120, now); // Low buzz
      osc.frequency.linearRampToValueAtTime(90, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'click') {
      // Click/Tick sound for UI interactions
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.frequency.setValueAtTime(1000, now);
      
      osc.start(now);
      osc.stop(now + 0.15);
    }
  } catch (err) {
    console.warn('Audio play blocked or failed:', err);
  }
}

// Load face-api.js models from CDN
async function loadFaceApiModels() {
  if (modelsLoaded) return true;
  
  const indicator = document.createElement('div');
  indicator.id = 'model-loader-indicator';
  indicator.className = 'model-loading-indicator';
  indicator.innerHTML = `<div class="spinner"></div><span>Loading Face AI Models...</span>`;
  document.body.appendChild(indicator);
  
  try {
    const CDN_MODELS_URL = '/models/';
    
    // Wait for TFJS backend (WebGL or WASM) to be fully ready
    await faceapi.tf.ready();
    
    // Load required models
    await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_MODELS_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(CDN_MODELS_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(CDN_MODELS_URL);
    
    modelsLoaded = true;
    indicator.classList.add('hidden');
    setTimeout(() => indicator.remove(), 600);
    return true;
  } catch (error) {
    console.error('Failed to load Face-API models:', error);
    indicator.innerHTML = `❌ <span style="color:var(--danger)">Model Load Failed. Refresh and try again.</span>`;
    showToast('Failed to load Face-API. Ensure internet connection.', 'error');
    return false;
  }
}

// Generic API caller helper
async function apiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'API request failed.');
    }
    return result.data;
  } catch (error) {
    console.error(`API Error on ${endpoint}:`, error);
    showToast(error.message, 'error');
    throw error;
  }
}

// Utility to crop face coordinates and convert to base64
function captureFaceSnapshot(videoElement, detectionBox) {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set padding to capture a bit of surrounding context for the avatar
    const pad = 0.25; 
    const box = detectionBox;
    
    let x = box.x - box.width * pad;
    let y = box.y - box.height * pad;
    let w = box.width * (1 + pad * 2);
    let h = box.height * (1 + pad * 2);
    
    // Boundaries checks
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (w > videoElement.videoWidth) w = videoElement.videoWidth;
    if (h > videoElement.videoHeight) h = videoElement.videoHeight;
    
    canvas.width = 160;
    canvas.height = 160;
    
    // Draw mirrored back to correspond with webcam scaleX(-1) display
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    
    ctx.drawImage(
      videoElement,
      videoElement.videoWidth - (x + w), // Adjust src X due to mirror
      y,
      w,
      h,
      0,
      0,
      canvas.width,
      canvas.height
    );
    
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch (err) {
    console.error('Error capturing face thumbnail:', err);
    return '';
  }
}

// Utility to format timestamp to human-friendly local string
function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });
}
