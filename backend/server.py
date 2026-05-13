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
# This saves the data to your 'messages' collection in MongoDB
        db['messages'].insert_one(data)
        
        return jsonify({"message": "Message received by the Great Library of Atlantis!"}), 201
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Render needs the host set to 0.0.0.0
    app.run(host='0.0.0.0', port=5001, debug=True)
        
        # This saves the message to a new collection in your ClusterAtlantis
        messages_collection = db['messages']
        messages_collection.insert_one(data)
        
        return jsonify({"message": "Success! Message sent to the Great Library."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# -------------------------

if __name__ == '__main__':
    app.run(port=5001, debug=True)
