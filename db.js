const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, 'database');
const DB_FILE = path.join(DB_DIR, 'db.json');

// Initialize database file and folder if they don't exist
function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      members: [],
      logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Read database contents
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local database:', error);
    return { members: [], logs: [] };
  }
}

// Write database contents
function writeDb(data) {
  initDb();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to local database:', error);
    return false;
  }
}

// Member operations
const db = {
  getMembers() {
    const data = readDb();
    return data.members || [];
  },

  saveMember(member) {
    const data = readDb();
    if (!data.members) data.members = [];
    
    // Check if member already exists (by name and contact to prevent duplicates)
    const existsIndex = data.members.findIndex(
      m => m.name.toLowerCase() === member.name.toLowerCase() && m.contact === member.contact
    );
    
    const newMember = {
      id: member.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      name: member.name,
      contact: member.contact,
      role: member.role || 'Visitor',
      reason: member.reason || 'Not specified',
      descriptor: member.descriptor, // Array of 128 numbers
      photo: member.photo || '', // base64 string
      createdAt: member.createdAt || new Date().toISOString()
    };

    if (existsIndex > -1) {
      data.members[existsIndex] = newMember;
    } else {
      data.members.push(newMember);
    }

    writeDb(data);
    return newMember;
  },

  deleteMember(id) {
    const data = readDb();
    if (!data.members) data.members = [];
    
    const filteredMembers = data.members.filter(m => m.id !== id);
    const deleted = filteredMembers.length !== data.members.length;
    data.members = filteredMembers;
    
    writeDb(data);
    return deleted;
  },

  // Log operations
  getLogs() {
    const data = readDb();
    return data.logs || [];
  },

  addLog(log) {
    const data = readDb();
    if (!data.logs) data.logs = [];

    const newLog = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      memberId: log.memberId || null,
      name: log.name || 'Unknown Face',
      role: log.role || 'Unknown',
      contact: log.contact || 'N/A',
      reason: log.reason || 'N/A',
      photo: log.photo || '', // base64 current scan snapshot
      timestamp: new Date().toISOString(),
      status: log.status || 'Access Denied' // 'Access Granted', 'Access Denied', 'Registered'
    };

    data.logs.push(newLog);
    // Keep logs size manageable (e.g. last 1000 logs)
    if (data.logs.length > 1000) {
      data.logs = data.logs.slice(-1000);
    }

    writeDb(data);
    return newLog;
  },

  clearLogs() {
    const data = readDb();
    data.logs = [];
    writeDb(data);
    return true;
  },

  // Stats operations
  getStats() {
    const data = readDb();
    const members = data.members || [];
    const logs = data.logs || [];
    
    const totalMembers = members.length;
    const residentsCount = members.filter(m => m.role.toLowerCase() === 'resident').length;
    const staffCount = members.filter(m => m.role.toLowerCase() === 'staff').length;
    
    // Calculate logs for today (local time)
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
    
    const activeVisitorsToday = new Set(
      todayLogs
        .filter(l => l.role.toLowerCase() === 'visitor' && l.status === 'Access Granted')
        .map(l => l.memberId || l.name)
    ).size;

    const deliveryEntriesToday = todayLogs.filter(
      l => l.role.toLowerCase() === 'delivery' && l.status === 'Access Granted'
    ).length;

    const alertsToday = todayLogs.filter(l => l.status === 'Access Denied').length;

    return {
      totalMembers,
      residentsCount,
      staffCount,
      activeVisitorsToday,
      deliveryEntriesToday,
      alertsToday,
      recentLogs: logs.slice(-10).reverse() // Last 10 logs, newest first
    };
  }
};

module.exports = db;
