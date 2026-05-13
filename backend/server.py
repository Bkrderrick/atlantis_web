from flask import Flask, jsonify
from flask_cors import CORS
from database import get_db

app = Flask(__name__)
CORS(app) 

db = get_db()

@app.route('/api/atlantis-data', methods=['GET'])
def get_data():
    try:
        collection = db['items']
        # This is the "Fetch" logic on the backend side
        data = list(collection.find({}, {'_id': 0})) 
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Running on 5001 so it doesn't clash with React (3000)
    app.run(port=5001, debug=True)

