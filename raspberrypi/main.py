import firebase_admin
from firebase_admin import credentials, db
import time
import serial
import json
import sys

# Serial connection settings
SERIAL_PORT = '/dev/ttyUSB0'
BAUD_RATE = 9600

# Load credentials
cred = credentials.Certificate("./service_account_key.json")

# Initialize app
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://e-fishpond-default-rtdb.asia-southeast1.firebasedatabase.app/'
})

def connect_arduino():
    """Connect to Arduino via USB serial port"""
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        time.sleep(2)  # Wait for connection to establish
        print(f"Connected to Arduino on {SERIAL_PORT}")
        return ser
    except serial.SerialException as e:
        print(f"Error connecting to Arduino: {e}")
        print("Make sure Arduino is connected and port is correct")
        return None

def process_sensor_data(data):
    """Process and validate sensor data from Arduino"""
    try:
        parsed = json.loads(data)
        
        if "error" in parsed:
            print(f"[Arduino Error] {parsed['error']}")
            return False
        
        if "temp" in parsed:
            temp = parsed['temp']
            heater = parsed['heater']
            
            # Update Firebase with temperature data
            ref = db.reference('/sensors/water_temperature')
            ref.set({
                'value': temp,
                'unit': '°C',
                'timestamp': int(time.time())
            })
            
            # Update heater status
            heater_ref = db.reference('/devices/heater')
            heater_ref.set({
                'status': 'ON' if heater else 'OFF',
                'timestamp': int(time.time())
            })
            
            print(f"[Sensor Data] Temp: {temp}°C | Heater: {'ON' if heater else 'OFF'}")
            return True
            
    except json.JSONDecodeError:
        print(f"[Error] Invalid JSON received: {data}")
        return False
    except Exception as e:
        print(f"[Error] Failed to process data: {e}")
        return False

def main():
    """Main loop to read from Arduino and update Firebase"""
    ser = connect_arduino()
    
    if ser is None:
        print("Failed to connect to Arduino. Exiting.")
        sys.exit(1)
    
    print("Listening for sensor data from Arduino...")
    
    try:
        while True:
            if ser.in_waiting:
                try:
                    line = ser.readline().decode('utf-8').strip()
                    if line:
                        process_sensor_data(line)
                except UnicodeDecodeError:
                    print("[Warning] Failed to decode serial data")
            else:
                time.sleep(0.1)
                
    except KeyboardInterrupt:
        print("\nShutting down...")
        ser.close()
        sys.exit(0)
    except Exception as e:
        print(f"[Error] {e}")
        ser.close()
        sys.exit(1)

if __name__ == "__main__":
    main()

