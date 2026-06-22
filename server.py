import os
import json
import time
import uuid
from http.server import SimpleHTTPRequestHandler, HTTPServer

DB_DIR = os.path.join(os.getcwd(), 'database')
DB_FILE = os.path.join(DB_DIR, 'db.json')

def init_db():
    if not os.path.exists(DB_DIR):
        os.makedirs(DB_DIR)
    if not os.path.exists(DB_FILE):
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump({"members": [], "logs": []}, f, indent=2)

def read_db():
    init_db()
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print("Error reading database:", e)
        return {"members": [], "logs": []}

def write_db(data):
    init_db()
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print("Error writing database:", e)
        return False

class SocietySecurityHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query parameters (like ?t=123) for path resolution
        normalized_path = path.split('?')[0]
        if not normalized_path.startswith('/api'):
            return os.path.join(os.getcwd(), 'public', normalized_path.lstrip('/'))
        return super().translate_path(path)

    def do_GET(self):
        url_path = self.path.split('?')[0]
        if url_path.startswith('/api'):
            self.handle_api_get(url_path)
        else:
            super().do_GET()

    def do_POST(self):
        url_path = self.path.split('?')[0]
        if url_path.startswith('/api'):
            self.handle_api_post(url_path)
        else:
            self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        url_path = self.path.split('?')[0]
        if url_path.startswith('/api'):
            self.handle_api_delete(url_path)
        else:
            self.send_error(404, "Endpoint not found")

    def handle_api_get(self, path):
        db_data = read_db()
        
        if path == '/api/members':
            self.send_json_response({"success": True, "data": db_data.get("members", [])})
            
        elif path == '/api/logs':
            logs = db_data.get("logs", [])
            self.send_json_response({"success": True, "data": list(reversed(logs))})
            
        elif path == '/api/stats':
            members = db_data.get("members", [])
            logs = db_data.get("logs", [])
            
            total_members = len(members)
            residents_count = len([m for m in members if m.get("role", "").lower() == "resident"])
            staff_count = len([m for m in members if m.get("role", "").lower() == "staff"])
            
            # Simple today log filter (using current GMT/local date prefix)
            today_str = time.strftime("%Y-%m-%d")
            today_logs = [l for l in logs if l.get("timestamp", "").startswith(today_str)]
            
            # Active visitors today
            active_visitors = len(set([
                l.get("memberId") or l.get("name") 
                for l in today_logs 
                if l.get("role", "").lower() == "visitor" and l.get("status") == "Access Granted"
            ]))
            
            # Delivery entries today
            delivery_entries = len([
                l for l in today_logs 
                if l.get("role", "").lower() == "delivery" and l.get("status") == "Access Granted"
            ])
            
            # Alerts today (Access Denied)
            alerts = len([l for l in today_logs if l.get("status") == "Access Denied"])
            
            stats_data = {
                "totalMembers": total_members,
                "residentsCount": residents_count,
                "staffCount": staff_count,
                "activeVisitorsToday": active_visitors,
                "deliveryEntriesToday": delivery_entries,
                "alertsToday": alerts
            }
            self.send_json_response({"success": True, "data": stats_data})
        else:
            self.send_error(404, "API endpoint not found")

    def handle_api_post(self, path):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            body = json.loads(post_data.decode('utf-8'))
        except Exception as e:
            self.send_json_response({"success": False, "message": "Invalid JSON payload"}, 400)
            return

        db_data = read_db()

        if path == '/api/members':
            name = body.get('name')
            contact = body.get('contact')
            role = body.get('role', 'Visitor')
            reason = body.get('reason', 'Not specified')
            descriptor = body.get('descriptor')
            photo = body.get('photo', '')

            if not name or not contact:
                self.send_json_response({"success": False, "message": "Name and Contact are required"}, 400)
                return
            if not descriptor or len(descriptor) != 128:
                self.send_json_response({"success": False, "message": "Invalid face descriptor coordinates"}, 400)
                return

            # Check duplicate (by name and contact number)
            exists_idx = -1
            for idx, m in enumerate(db_data.get("members", [])):
                if m.get("name").lower() == name.lower() and m.get("contact") == contact:
                    exists_idx = idx
                    break

            member_id = body.get('id') or str(uuid.uuid4())[:8]
            new_member = {
                "id": member_id,
                "name": name,
                "contact": contact,
                "role": role,
                "reason": reason,
                "descriptor": descriptor,
                "photo": photo,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }

            if exists_idx > -1:
                db_data["members"][exists_idx] = new_member
            else:
                db_data["members"].append(new_member)

            # Record registration log
            new_log = {
                "id": str(uuid.uuid4())[:8],
                "memberId": member_id,
                "name": name,
                "role": role,
                "contact": contact,
                "reason": f"Enrolled: {reason}",
                "photo": photo,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": "Registered"
            }
            db_data["logs"].append(new_log)

            write_db(db_data)
            self.send_json_response({"success": True, "data": new_member})

        elif path == '/api/logs':
            member_id = body.get('memberId')
            name = body.get('name', 'Unknown Face')
            role = body.get('role', 'Unknown')
            contact = body.get('contact', 'N/A')
            reason = body.get('reason', 'N/A')
            photo = body.get('photo', '')
            status = body.get('status', 'Access Denied')

            new_log = {
                "id": str(uuid.uuid4())[:8],
                "memberId": member_id,
                "name": name,
                "role": role,
                "contact": contact,
                "reason": reason,
                "photo": photo,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "status": status
            }

            db_data["logs"].append(new_log)
            # Limit database logs
            if len(db_data["logs"]) > 1000:
                db_data["logs"] = db_data["logs"][-1000:]

            write_db(db_data)
            self.send_json_response({"success": True, "data": new_log})
        else:
            self.send_error(404, "API endpoint not found")

    def handle_api_delete(self, path):
        db_data = read_db()
        
        if path.startswith('/api/members/'):
            member_id = path.replace('/api/members/', '')
            members = db_data.get("members", [])
            filtered = [m for m in members if m.get("id") != member_id]
            
            if len(filtered) != len(members):
                db_data["members"] = filtered
                write_db(db_data)
                self.send_json_response({"success": True, "message": "Member unregistered successfully"})
            else:
                self.send_json_response({"success": False, "message": "Member not found"}, 404)
                
        elif path == '/api/logs':
            db_data["logs"] = []
            write_db(db_data)
            self.send_json_response({"success": True, "message": "Entry logs cleared"})
        else:
            self.send_error(404, "API endpoint not found")

    def send_json_response(self, data, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

def run_server(port=3000):
    server_address = ('', port)
    httpd = HTTPServer(server_address, SocietySecurityHandler)
    print(f"==================================================")
    print(f"  SOCIETY FACE RECOGNITION PYTHON BACKEND RUNNING ")
    print(f"  URL: http://localhost:{port}                    ")
    print(f"  Local database storing data in database/db.json ")
    print(f"==================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server.")
        httpd.server_close()

# Add WebAssembly MIME type mapping explicitly for streaming compilation
SocietySecurityHandler.extensions_map.update({
    '.wasm': 'application/wasm',
})

if __name__ == '__main__':
    run_server()
