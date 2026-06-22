const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Increase JSON body limits for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get all members
app.get('/api/members', (req, res) => {
  try {
    const members = db.getMembers();
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Register new member
app.post('/api/members', (req, res) => {
  try {
    const { name, contact, role, reason, descriptor, photo } = req.body;
    
    if (!name || !contact) {
      return res.status(400).json({ success: false, message: 'Name and Contact are required.' });
    }
    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return res.status(400).json({ success: false, message: 'Invalid face descriptor data.' });
    }

    const saved = db.saveMember({ name, contact, role, reason, descriptor, photo });
    
    // Log the registration event as well
    db.addLog({
      memberId: saved.id,
      name: saved.name,
      role: saved.role,
      contact: saved.contact,
      reason: `Registered: ${saved.reason}`,
      photo: saved.photo,
      status: 'Registered'
    });

    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete a member
app.delete('/api/members/:id', (req, res) => {
  try {
    const deleted = db.deleteMember(req.params.id);
    if (deleted) {
      res.json({ success: true, message: 'Member deleted successfully.' });
    } else {
      res.status(404).json({ success: false, message: 'Member not found.' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all logs
app.get('/api/logs', (req, res) => {
  try {
    const logs = db.getLogs();
    res.json({ success: true, data: logs.reverse() }); // Return newest logs first
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Log a face scanner detection event
app.post('/api/logs', (req, res) => {
  try {
    const { memberId, name, role, contact, reason, photo, status } = req.body;
    
    const logged = db.addLog({
      memberId,
      name,
      role,
      contact,
      reason,
      photo,
      status // 'Access Granted' or 'Access Denied'
    });

    res.json({ success: true, data: logged });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Clear logs
app.delete('/api/logs', (req, res) => {
  try {
    db.clearLogs();
    res.json({ success: true, message: 'Logs cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get society dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`  SOCIETY FACE RECOGNITION BACKEND RUNNING        `);
  console.log(`  URL: http://localhost:${PORT}                    `);
  console.log(`  Local database storing data in database/db.json`);
  console.log(`==================================================`);
});
