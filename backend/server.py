from flask import Flask, jsonify, request  # <--- Added 'request' here
from flask_cors import CORS
from database import get_db

app = Flask(__name__)
CORS(app)

db = get_db()

@app.route('/api/atlantis-data', methods=['GET'])
def get_data():
    try:
        collection = db['items']
        data = list(collection.find({}, {'_id': 0}))
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- NEW CONTACT ROUTE ---
@app.route('/api/contact', methods=['POST'])
def contact():
    try:
        data = request.json
        print(f"New message from {data.get('name')}: {data.get('request')}")
        
        # This saves the message to a new collection in your ClusterAtlantis
        messages_collection = db['messages']
        messages_collection.insert_one(data)
        
        return jsonify({"message": "Success! Message sent to the Great Library."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# -------------------------

if __name__ == '__main__':
    app.run(port=5001, debug=True)
