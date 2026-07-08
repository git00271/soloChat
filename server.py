import asyncio
import json
import websockets
import http.server
import socketserver
import threading
import sys

# HTTP Server setup
PORT = 8000
class MyHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for clean development cycle
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

def run_http_server():
    handler = MyHTTPHandler
    # Allow reuse address to prevent "Port already in use" errors during sequential runs
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"HTTP Server running at http://localhost:{PORT}")
        httpd.serve_forever()

# WebSocket Server states
connected_clients = {}  # table_number (int) -> websocket
client_metadata = {}    # table_number (int) -> { gender, age, mood }

async def broadcast_status():
    if not connected_clients:
        return
    payload = {
        "type": "status_update",
        "tables": client_metadata
    }
    message = json.dumps(payload)
    # Send status updates concurrently to all clients
    await asyncio.gather(*[client.send(message) for client in connected_clients.values()], return_exceptions=True)

async def handler(websocket):
    current_table = None
    try:
        async for message in websocket:
            data = json.loads(message)
            mtype = data.get("type")

            if mtype == "register":
                table = int(data.get("table"))
                gender = data.get("gender")
                age = int(data.get("age"))
                mood = data.get("mood")

                # Map table to the connection
                connected_clients[table] = websocket
                client_metadata[table] = {
                    "gender": gender,
                    "age": age,
                    "mood": mood
                }
                current_table = table
                print(f"[REGISTER] Table {table} registered (Gender: {gender}, Age: {age}, Mood: {mood})")
                await broadcast_status()

            elif mtype == "mood_update":
                if current_table and current_table in client_metadata:
                    client_metadata[current_table]["mood"] = data.get("mood")
                    print(f"[MOOD CHANGE] Table {current_table} changed mood to: {data.get('mood')}")
                    await broadcast_status()

            elif mtype == "whisper":
                to_table = int(data.get("to"))
                text = data.get("text")
                time_str = data.get("time")

                if to_table in connected_clients:
                    target_ws = connected_clients[to_table]
                    payload = {
                        "type": "whisper",
                        "from": current_table,
                        "text": text,
                        "time": time_str
                    }
                    await target_ws.send(json.dumps(payload))
                    print(f"[WHISPER] Table {current_table} -> Table {to_table}: {text}")
                else:
                    # Target table is offline/mock
                    print(f"[WHISPER FALLBACK] Table {current_table} -> Table {to_table} (Offline/Mock bot): {text}")
                    payload = {
                        "type": "whisper_error",
                        "to": to_table,
                        "reason": "offline"
                    }
                    await websocket.send(json.dumps(payload))

            elif mtype == "flex_broadcast":
                item = data.get("item")
                amount = data.get("amount")
                print(f"[FLEX] Table {current_table} popped: {item} ({amount} KRW)")
                
                payload = {
                    "type": "flex_broadcast",
                    "table": current_table,
                    "item": item,
                    "amount": amount
                }
                message_str = json.dumps(payload)
                await asyncio.gather(*[client.send(message_str) for client in connected_clients.values()], return_exceptions=True)

    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        if current_table is not None:
            connected_clients.pop(current_table, None)
            client_metadata.pop(current_table, None)
            print(f"[DISCONNECT] Table {current_table} left the bar")
            await broadcast_status()

async def main():
    # Start HTTP Server on a daemon thread
    http_thread = threading.Thread(target=run_http_server, daemon=True)
    http_thread.start()

    # Start WebSocket Server
    async with websockets.serve(handler, "localhost", 8765):
        print("WebSocket Server running at ws://localhost:8765")
        await asyncio.Future()  # Keep running

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nStopping HTTP and WebSocket servers...")
        sys.exit(0)
