from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
CORS(app)

DATA_DIR = os.getenv("DATA_DIR", "./data")
os.makedirs(DATA_DIR, exist_ok=True)
DB_NAME = os.path.join(DATA_DIR, "shop.db")

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()

    #Create the 'products' table if it does not already exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT,
            description TEXT,
            image_url TEXT
        )
    ''')
    
    #Query the total number of products currently in the database
    cursor.execute('SELECT COUNT(*) FROM products')

    #If the database is empty, populate it with an initial list of sample store items
    if cursor.fetchone()[0] == 0:
        sample_products = [
            ("Tattoo Aftercare Cream", 15.49, "Aftercare", "Soothing, natural balm designed to accelerate skin healing.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/aftercare cream.jpeg"),
            ("Numbing Cream", 15.99, "Aftercare", "Fast-acting topical numbing agent for comfortable long sessions.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/numbing cream.jpeg"),
            ("Antibacterial Foam Soap", 15.00, "Aftercare", "Gentle, fragrance-free cleansing wash for fresh tattoos.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/Tattoo Soap.jpeg"),
            ("SPF 50 Tattoo Sunscreen Spray", 19.99, "Aftercare", "Broad-spectrum UV protection spray engineered to prevent fading.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/50 spray.jpg"),
            ("Protective Healing Film Roll", 20.00, "Aftercare", "Waterproof, breathable adhesive bandage roll (Second Skin).", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/Roll.webp"),
            ("Ink Revitalizing Body Butter", 30.00, "Aftercare", "Deep-moisturizing daily lotion to boost color contrast.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/tattoo butter.webp"),
            ("Flash Art Book (Vol. 1)", 49.99, "Merch", "Art of tattoo. Hardcover book featuring over 100 original custom tattoo flash illustrations.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/Tattoo Sketchbook by YUMI.jpeg"),
            ("Stencil Transfer Gel", 18.00, "Supplies", "Professional-grade stencil application gel for crisp placement.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/transfer gel.jpg"),
            ("Mariarty Merch T-Shirt", 32.50, "Merch", "White T-Shirt with original tattoo design.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/merch shirt.jpeg"),
            ("Flash Art Book (Vol. 2)", 49.99, "Merch", "Hardcover book featuring over 150 original custom tattoo flash illustrations.", "https://mariartystudio.blob.core.windows.net/tattoostudio-images/Books by Vault Editions.jpeg")
        ]

        #Bulk insert all sample product rows into the table
        cursor.executemany('''
            INSERT INTO products (name, price, category, description, image_url)
            VALUES (?, ?, ?, ?, ?)
        ''', sample_products)
    
    conn.commit()
    conn.close()

init_db()


#Fetch product catalogue
@app.route('/products', methods=['GET'])
def get_products():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute('SELECT id, name, price, category, description, image_url FROM products')
    rows = cursor.fetchall()
    conn.close()

    #Map raw SQL tuples into a list of structured JSON-ready dictionary objects
    products = [
        {
            "id": r[0],
            "name": r[1],
            "price": r[2],
            "category": r[3],
            "description": r[4],
            "image_url": r[5]
        }
        for r in rows
    ]
    return jsonify(products), 200


#Create order
@app.route('/orders', methods=['POST'])
def create_order():
    data = request.json

    #Read list of ordered items and total price with fallback defaults
    items = data.get('items', [])
    total = data.get('total', 0.0)

    #Return success response containing the summary total and item count
    return jsonify({
        "success": True, 
        "message": "Order processed successfully", 
        "total": total,
        "items_count": len(items)
    }), 201

if __name__ == '__main__':
    app.run(host = "0.0.0.0", port=5003, debug=True)