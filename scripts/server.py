import asyncio
import websockets
import json
import threading
import time
from flask import Flask, jsonify
import websocket
from datetime import datetime

# Bybit WebSocket URL (USDT Perpetual, USDC Perpetual)
BYBIT_WS_URL = "wss://stream.bybit.com/v5/public/linear"

# Track liquidations
liquidation_data = []

# Symbols to track
SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "DOGEUSDT", "ADAUSDT"]

# Flask API to serve real-time data
app = Flask(__name__)

@app.route('/api/liquidation', methods=['GET'])
def get_liquidation():
    """Serve liquidation data as JSON."""
    return jsonify({"liquidations": liquidation_data})

def on_message(ws, message):
    """Handles incoming messages from Bybit WebSocket."""
    global liquidation_data
    data = json.loads(message)

    if "data" in data and isinstance(data["data"], list):
        for entry in data["data"]:
            record = {
                "timestamp": datetime.utcfromtimestamp(entry["T"] / 1000).strftime('%Y-%m-%d %H:%M:%S'),
                "symbol": entry["s"],
                "side": entry["S"],
                "size": entry["v"],
                "price": entry["p"]
            }
            liquidation_data.insert(0, record)

            # Keep last 50 records to prevent memory overflow
            if len(liquidation_data) > 50:
                liquidation_data.pop()

            print(f"[{datetime.utcnow()}] {record}")

def on_open(ws):
    """Subscribes to Bybit liquidation stream."""
    print(f"[{datetime.utcnow()}] Connected to Bybit WebSocket. Subscribing...")
    subscribe_msg = {
        "op": "subscribe",
        "args": [f"allLiquidation.{symbol}" for symbol in SYMBOLS]
    }
    ws.send(json.dumps(subscribe_msg))

def start_bybit_ws():
    """Start Bybit WebSocket connection."""
    ws = websocket.WebSocketApp(
        BYBIT_WS_URL,
        on_message=on_message,
        on_open=on_open
    )
    ws.run_forever()

if __name__ == "__main__":
    # Run Bybit WebSocket in a separate thread
    threading.Thread(target=start_bybit_ws, daemon=True).start()

    # Start Flask API to serve data
    app.run(host="0.0.0.0", port=5000, debug=True)
