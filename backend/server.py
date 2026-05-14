from flask import Flask, jsonify, request
from flask_cors import CORS
from database import get_db
import os

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "https://atlantis-bnb-dbaker.netlify.app"}})

db = get_db()

@app.route('/api/atlantis-data', methods=['GET'])
def get_data():
    try:
        collection = db['items']
        data = list(collection.find({}, {'_id': 0}))
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/contact', methods=['GET'])
def get_messages():
    try:
        collection = db['messages']
        data = list(collection.find({}, {'_id': 0}))
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/contact', methods=['POST'], strict_slashes=False)
def contact():
    try:
        data = request.json
        db['messages'].insert_one(data)
        return jsonify({"message": "Success! Message sent to Atlantis."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Use the port Render gives us, or default to 5001 for local
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port)
