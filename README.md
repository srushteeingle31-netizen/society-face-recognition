# Society Guard AI - Face Recognition Entry System

A premium, local face recognition and entry logging system designed for housing societies. The application uses a local JSON database and performs client-side neural network face matching via the `face-api.js` library, rendering detailed statistics, real-time security alerts, and logs on a dark-themed glassmorphism Admin Dashboard.

## Features

- **Automated Entrance Gate Scanner**: Real-time webcam scanning with face matching, sound chime confirmations, and access status displays.
- **Member Face Enrollment**: Form validation to register new Residents, Visitors, Staff, or Delivery Personnel with face landmarks and descriptor generation.
- **Admin Control Panel**: Real-time traffic stats, search capabilities, full-size scan snapshot viewing, member unregistration, and log clearance.
- **Zero-Dependency Local Server**: Built completely on Python's native libraries. No package installation (`pip` or `npm`) required!

---

## How to Run the System

Since the environment has Python 3 installed, you can start the application immediately with zero configuration!

1. Open your terminal or command prompt.
2. Navigate to the project directory:
   ```cmd
   cd C:\Users\admin\.gemini\antigravity\scratch\society-face-recognition
   ```
3. Run the python backend server:
   ```cmd
   python server.py
   ```
4. Open your web browser and go to:
   ```
   http://localhost:3000
   ```

---

## Project Structure

- `server.py` - Custom Python HTTP server mapping requests to the front-end assets and database endpoints.
- `database/db.json` - Local database storing enrolled member details (including 128-dimensional facial coordinates) and entry timestamps.
- `public/` - Static assets served to the client browser:
  - `index.html` - Gate Scanner gateway (Home page).
  - `register.html` - Face Enrollment screen.
  - `admin.html` - Admin Dashboard panel.
  - `css/style.css` - Visual styling system (Dark mode + Glassmorphic components).
  - `js/app.js` - Shared scripts (CDN model loaders, Web Audio synth alerts).
  - `js/scanner.js` - Camera feed matching loop and Euclidean distance face matcher.
  - `js/register.js` - Coordinates face landmarks detection and form submissions.
  - `js/admin.js` - Powers real-time stats, directory tables, search filters, and modals.

---

## Important System Notes

- **Webcam Permissions**: Ensure your browser is granted camera access. Accessing the system via `http://localhost:3000` is trusted by the browser as a secure origin, allowing webcam usage without needing SSL/HTTPS certificates.
- **Local DB File**: All database entries are written directly to `database/db.json` on your disk. You can back up or clear this file manually at any time.
- **Internet Access**: The web client uses a CDN to retrieve neural network models (`tinyFaceDetector`, `faceLandmark68`, and `faceRecognitionNet`) when it first starts up. This requires an active internet connection on the browser client, after which the browser will cache them locally.
