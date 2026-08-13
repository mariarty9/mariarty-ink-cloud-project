from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import requests
import os

app = Flask(__name__)
CORS(app)

DATA_DIR = os.getenv("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_NAME = os.path.join(DATA_DIR, "bookings.db")

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    #Create the 'bookings' table if it does not already exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_name TEXT NOT NULL,
            client_email TEXT,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            style TEXT NOT NULL,
            placement TEXT NOT NULL,
            notes TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')

    #Check if any records exist in the table
    cursor.execute("SELECT COUNT(*) FROM bookings")

    #Insert a default seed booking if the table is currently empty
    if cursor.fetchone()[0] == 0:
        cursor.execute('''
            INSERT INTO bookings (client_name, client_email, date, time, style, placement, notes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ("John Doe", "john@example.com", "2026-08-15", "14:00", "Realism", "Outer Forearm", "Pocket watch fading into a skull.", "confirmed"))
        conn.commit()
    conn.close()

init_db()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Booking Service is running!"}), 200

#Get all bookings
@app.route('/bookings', methods=['GET'])
def get_bookings():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM bookings")
    rows = cursor.fetchall()
    conn.close()
    
    bookings = [dict(row) for row in rows]
    return jsonify(bookings), 200

#Create new bookings
@app.route('/bookings', methods=['POST'])
def create_booking():
    data = request.json
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO bookings (client_name, client_email, date, time, style, placement, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    ''', (
        data.get("client_name"),
        data.get("client_email"),
        data.get("date"),
        data.get("time"),
        data.get("style"),
        data.get("placement"),
        data.get("notes")
    ))
    conn.commit()
    booking_id = cursor.lastrowid
    conn.close()
    
    #Resolve the target URL for the email notification service
    email_service_url = os.getenv("EMAIL_SERVICE_URL", "http://localhost:5002/send-email")

    #Attempt to trigger an HTTP POST request to send a confirmation email
    try:
        requests.post(email_service_url, json={
            "client_name": data.get("client_name"),
            "client_email": data.get("client_email"),
            "date": data.get("date"),
            "style": data.get("style", "Custom Tattoo")
        }, timeout=2)
    except Exception as e:

        #Catch and log network/service errors if email sending fails
        print(f"[WARNING] Could not trigger email serverless service: {e}")

    return jsonify({"success": True, "message": "Booking submitted successfully", "id": booking_id}), 201

#Update or delete booking by ID
@app.route('/bookings/<int:booking_id>', methods=['PUT', 'DELETE'])
def modify_booking(booking_id):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    if request.method == 'DELETE':
        cursor.execute("DELETE FROM bookings WHERE id = ?", (booking_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Booking deleted"}), 200
        
    elif request.method == 'PUT':
        data = request.json
        new_status = data.get("status")
        cursor.execute("UPDATE bookings SET status = ? WHERE id = ?", (new_status, booking_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Booking status updated"}), 200

if __name__ == '__main__':
    app.run(host = "0.0.0.0", port=5001, debug=True)