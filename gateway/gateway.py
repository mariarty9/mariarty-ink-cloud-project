from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import datetime
import requests
import os

app = Flask(__name__)
CORS(app)

#DB lives in DATA_DIR so it can be mounted as a persistent volume (see k8s/deployments.yaml).
#Defaults to a local ./data folder so nothing extra is needed for plain local runs.
DATA_DIR = os.getenv("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_NAME = os.path.join(DATA_DIR, "studio.db")

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    #Create the 'users' table if it does not exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'client',
            discount INTEGER DEFAULT 0
        )
    ''')

    #Check if the default admin account exists in the database
    cursor.execute("SELECT * FROM users WHERE email = ?", ("admin@mariarty.com",))
    if not cursor.fetchone():

        #Hash default admin password and insert initial artist/admin account
        hashed_pw = generate_password_hash("tattoo2024")
        cursor.execute(
            "INSERT INTO users (email, password_hash, role, discount) VALUES (?, ?, ?, ?)",
            ("admin@mariarty.com", hashed_pw, "artist", 0)
        )
        conn.commit()
        
    conn.close()

init_db()

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "Gateway & Database running successfully!"}), 200

#User registration
@app.route('/api/register', methods=['POST'])
def register():

    #Extract email and password from incoming JSON payload
    data = request.json
    email = data.get('email')
    password = data.get('password')

    #Validate that both email and password are provided
    if not email or not password:
        return jsonify({"success": False, "message": "Email and password required"}), 400

    #Securely hash the user's passwor
    hashed_pw = generate_password_hash(password)
    
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (email, password_hash, role, discount) VALUES (?, ?, 'client', 10)",
            (email, hashed_pw)
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Account created! You now have 10% member discount."}), 201
    except sqlite3.IntegrityError:

        #Catch duplicate email errors if user already exists
        return jsonify({"success": False, "message": "Email already registered."}), 400


#User login and session issuance
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    #Retrieve user record matching the provided email
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()

    #Verify user exists and provided password matches stored hash
    if user and check_password_hash(user["password_hash"], password):

        #Calculate session expiration timestamp (30 minutes from current time)
        expires_at = datetime.datetime.now() + datetime.timedelta(minutes=30)

        #Successful login
        return jsonify({
            "success": True,
            "message": "Login successful",
            "role": user["role"],
            "discount": user["discount"],
            "expires_at": expires_at.timestamp()
        }), 200
    else:

        #Authorisation failure for invalid credentials
        return jsonify({
            "success": False,
            "message": "Invalid email or password"
        }), 401

#Gateway proxy routes for booking

BOOKING_SERVICE_URL = os.getenv("BOOKING_SERVICE_URL", "http://booking-service:5001")

@app.route('/api/bookings', methods=['GET', 'POST'])
def proxy_bookings():
    #Forward incoming GET requests to the booking microservice
    if request.method == 'GET':
        resp = requests.get(f"{BOOKING_SERVICE_URL}/bookings")
        return jsonify(resp.json()), resp.status_code
    #Forward incoming POST requests (new bookings) to the booking microservice
    elif request.method == 'POST':
        resp = requests.post(f"{BOOKING_SERVICE_URL}/bookings", json=request.json)
        return jsonify(resp.json()), resp.status_code

@app.route('/api/bookings/<int:booking_id>', methods=['PUT', 'DELETE'])
def proxy_modify_booking(booking_id):
    #Forward incoming PUT requests (status updates) to the bm
    if request.method == 'PUT':
        resp = requests.put(f"{BOOKING_SERVICE_URL}/bookings/{booking_id}", json=request.json)
        return jsonify(resp.json()), resp.status_code
    #Forward incoming DELETE requests to the bm
    elif request.method == 'DELETE':
        resp = requests.delete(f"{BOOKING_SERVICE_URL}/bookings/{booking_id}")
        return jsonify(resp.json()), resp.status_code

#Gateway proxy routes for the shop microservice

SHOP_SERVICE_URL = os.getenv("SHOP_SERVICE_URL", "http://shop-service:5003")

@app.route('/api/products', methods=['GET'])
def proxy_products():
    #Forward product catalogue requests to the shop microservice
    resp = requests.get(f"{SHOP_SERVICE_URL}/products")
    return jsonify(resp.json()), resp.status_code

@app.route('/api/orders', methods=['POST'])
def proxy_orders():
    #Forward new order requests to the shop microservice
    resp = requests.post(f"{SHOP_SERVICE_URL}/orders", json=request.json)
    return jsonify(resp.json()), resp.status_code

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)