import firebase_admin
from firebase_admin import credentials, db
import time

# Load credentials
cred = credentials.Certificate("../service_account_key.json")

# Initialize app
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://e-fishpond-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

# Define callback functions for real-time updates
def on_ph_level_update(message):
    print(f"[pH Level] Updated: {message.data}")

def on_water_temperature_update(message):
    print(f"[Water Temperature] Updated: {message.data}")

def on_dissolved_oxygen_update(message):
    print(f"[Dissolved Oxygen] Updated: {message.data}")

# Set up real-time listeners for each sensor
db.reference('/sensors/ph_level').listen(on_ph_level_update)
db.reference('/sensors/water_temperature').listen(on_water_temperature_update)
db.reference('/sensors/dissolved_oxygen').listen(on_dissolved_oxygen_update)

print("Listeners started. Waiting for updates...")

# Send initial data
ref = db.reference('/sensors/ph_level')
ref.set({
    'value': 30,
    'unit': 'pH'
})

ref = db.reference('/sensors/water_temperature')
ref.set({
    'value': 27.5,
    'unit': '°C'
})

ref = db.reference('/sensors/dissolved_oxygen')
ref.set({
    'value': 1,
    'unit': 'mg/L'
})

# Keep the program running to listen for real-time updates
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("\nShutting down...")
    exit()