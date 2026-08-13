from flask import Flask, request, jsonify
from flask_cors import CORS
import json
from function import lambda_handler

app = Flask(__name__)
CORS(app)

#Email trigger endpoint
@app.route('/send-email', methods=['POST'])
def handle_email_trigger():
    event_data = request.json
    result = lambda_handler(event_data, None)
    body = json.loads(result['body'])
    return jsonify(body), result['statusCode']

if __name__ == '__main__':
    app.run(host = "0.0.0.0", port=5002, debug=True)