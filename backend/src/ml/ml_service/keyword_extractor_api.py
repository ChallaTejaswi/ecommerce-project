from flask import Flask, request, jsonify
from keyword_extractor import train_keyword_extractor

app = Flask(__name__)

# For demo: use a static product list. In production, load from DB or file.
product_names = [
    "Red Dress", "Blue Jeans", "Wireless Earbuds", "Smartphone", "Coffee Maker",
    "Yoga Mat", "Running Shoes", "Leather Wallet", "Sunglasses", "Bluetooth Speaker"
]
extractor = train_keyword_extractor(product_names)

@app.route('/extract', methods=['POST'])
def extract():
    data = request.json
    query = data.get('query', '')
    matches = extractor.extract(query)
    return jsonify({"matches": matches})

if __name__ == '__main__':
    app.run(port=5005)
