import firebase_admin
from firebase_admin import credentials, db
import time
import serial
import json
import sys
from datetime import datetime, timedelta, timezone
from threading import Thread

# Serial connection settings
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 9600

# Firebase node paths
FEEDING_SCHEDULES_PATH = "/feeding_schedules"
CLEANING_SCHEDULES_PATH = "/cleaning_schedules"

# optimal range paths
OPT_RANGE_DO_PATH = "/opt_range_do"
OPT_RANGE_TEMP_PATH = "/opt_range_temp"

# Sensor/Device paths
TEMP_SENSOR_PATH = "/sensors/water_temperature"
PH_SENSOR_PATH = "/sensors/ph_level"
DO_SENSOR_PATH = "/sensors/dissolved_oxygen"
HEATER_PATH = "/devices/heater"

# Devices paths
HEATER_DEVICE_PATH = "/devices/heater"
COOLER_DEVICE_PATH = "/devices/cooler"
AERATOR_DEVICE_PATH = "/devices/aerator"

# Load credentials
cred = credentials.Certificate("./service_account_key.json")

# Initialize app
firebase_admin.initialize_app(
    cred,
    {"databaseURL": "https://e-fishpond-default-rtdb.asia-southeast1.firebasedatabase.app/"}, # production URL
    # {"databaseURL": "http://192.168.1.23:9000/?ns=e-fishpond"}, # local emulator URL
)

# Global cache for schedules
feeding_schedules_cache = {}
cleaning_schedules_cache = {}

# cache for optimal ranges
opt_ranges_cache = {
    "do": None,
    "temp": None,
}

WINDOW_MINUTES = 1  # range to consider "equal" to schedule time
SCHEDULE_REFRESH_SECONDS = 10  # how often to refresh schedules from Firebase


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


# -----------------------------
# Helpers: datetime
# -----------------------------
def parse_iso(iso_str: str) -> datetime | None:
    try:
        if not iso_str:
            return None
        if iso_str.endswith("Z"):
            iso_str = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def is_within_minutes(target: datetime, now: datetime, minutes: int) -> tuple[bool, float]:
    """
    Returns (within_window, diff_seconds)
    diff_seconds is (now - target). Negative means target is in the future.
    """
    diff = (now - target).total_seconds()
    within = abs(diff) <= (minutes * 60)
    return within, diff


def compute_next_run(schedule: dict, now_utc: datetime) -> datetime | None:
    if not schedule or schedule.get("enabled") is False:
        return None

    run_at = parse_iso(schedule.get("run_at", ""))
    if run_at is None:
        return None

    repeat_daily = bool(schedule.get("repeat_daily", False))

    if not repeat_daily:
        return run_at if run_at > now_utc else None

    # daily schedule: run at the same HH:MM every day
    next_dt = now_utc.replace(
        hour=run_at.hour, minute=run_at.minute, second=0, microsecond=0
    )
    if next_dt <= now_utc:
        next_dt += timedelta(days=1)

    return next_dt


def get_next_cleaning_schedule(cleaning_schedules: dict) -> tuple[str, dict, datetime] | None:
    now_utc = datetime.now(timezone.utc)
    best = None  # (next_run, id, schedule)

    for schedule_id, s in cleaning_schedules.items():
        next_run = compute_next_run(s, now_utc)
        if next_run is None:
            continue
        if best is None or next_run < best[0]:
            best = (next_run, schedule_id, s)

    if best is None:
        return None

    next_run, schedule_id, schedule = best
    return schedule_id, schedule, next_run


def is_cleaning_time_now(next_run_utc: datetime, window_minutes: int = 0) -> bool:
    """
    Compare next cleaning schedule with current UTC time.

    Args:
        next_run_utc (datetime): schedule time in UTC (must be timezone-aware)
        window_minutes (int): allowed range before and after schedule

    Returns:
        bool: True if current UTC time is within range, False otherwise
    """

    if next_run_utc is None:
        return False

    now_utc = datetime.now(timezone.utc)

    start_range = next_run_utc - timedelta(minutes=window_minutes)
    end_range = next_run_utc + timedelta(minutes=window_minutes)

    return start_range <= now_utc <= end_range


# -----------------------------
# Schedule fetchers (unchanged)
# -----------------------------
def fetch_feeding_schedules() -> dict:
    try:
        data = db.reference(FEEDING_SCHEDULES_PATH).get() or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[Schedules] Failed to fetch feeding schedules: {e}")
        return {}


def refresh_feeding_schedules_cache():
    global feeding_schedules_cache
    feeding_schedules_cache = fetch_feeding_schedules()
    print(f"[Schedules] Feeding schedules loaded: {len(feeding_schedules_cache)} item(s)")


def fetch_cleaning_schedules() -> dict:
    try:
        data = db.reference(CLEANING_SCHEDULES_PATH).get() or {}
        return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"[Cleaning] Failed to fetch cleaning schedules: {e}")
        return {}


def refresh_cleaning_schedules_cache():
    global cleaning_schedules_cache
    cleaning_schedules_cache = fetch_cleaning_schedules()
    print(f"[Schedules] Cleaning schedules loaded: {len(cleaning_schedules_cache)} item(s)")


# -----------------------------
# Optimal range functions (kept)
# -----------------------------
def _normalize_opt_range(node_value: object, label: str) -> dict | None:
    if not isinstance(node_value, dict):
        return None
    try:
        return {
            "min": float(node_value.get("min")),
            "max": float(node_value.get("max")),
            "unit": str(node_value.get("unit", "")).strip() or "N/A",
        }
    except Exception:
        print(f"[OptRange] {label}: invalid format: {node_value}")
        return None


def fetch_optimal_ranges() -> tuple[dict | None, dict | None]:
    try:
        do_raw = db.reference(OPT_RANGE_DO_PATH).get()
    except Exception as e:
        print(f"[OptRange] Failed to fetch {OPT_RANGE_DO_PATH}: {e}")
        do_raw = None

    try:
        temp_raw = db.reference(OPT_RANGE_TEMP_PATH).get()
    except Exception as e:
        print(f"[OptRange] Failed to fetch {OPT_RANGE_TEMP_PATH}: {e}")
        temp_raw = None

    do_range = _normalize_opt_range(do_raw, "DO") if do_raw is not None else None
    temp_range = _normalize_opt_range(temp_raw, "TEMP") if temp_raw is not None else None
    return do_range, temp_range


def send_opt_ranges_to_arduino(ser: serial.Serial, do_range: dict | None, temp_range: dict | None):
    if ser is None:
        return

    payload = {
        "type": "opt_ranges",
        "timestamp": int(time.time()),
        "do": do_range,
        "temp": temp_range,
    }

    try:
        ser.write((json.dumps(payload) + "\n").encode("utf-8"))
        ser.flush()
        print("[Arduino] Sent optimal ranges")
    except Exception as e:
        print(f"[Arduino] Failed to send optimal ranges: {e}")


def send_device_control(ser, name: str, value: int):
    # t = type, n = device name, v = value
    # dc = device control, a = aerator, h = heater, co = cooler, cl = cleaner
    message = f"t=dc,n={name},v={int(value)}\n"
    ser.write(message.encode("utf-8"))
    ser.flush()
    print("Sent:", message.strip())


def fetch_and_send_opt_ranges_once(ser: serial.Serial | None):
    do_range, temp_range = fetch_optimal_ranges()
    print("[OptRange] DO:", do_range)
    print("[OptRange] TEMP:", temp_range)
    if ser is not None:
        send_opt_ranges_to_arduino(ser, do_range, temp_range)


# -----------------------------
# UPDATED: process sensor data
# -----------------------------
def process_sensor_data(line: str) -> bool:
    """
    Expected Arduino JSON:
      {"temp": 28.75, "ph": 7.12, "do": 6.41, "heater": true}
      {"temp": null, "ph": 7.10, "do": null, "heater": false}
      {"error": "..."}
    """


    def update_ph_async(ph, ts):
        db.reference(PH_SENSOR_PATH).update({
            "value": float(ph),
            "timestamp": ts
        })
    
    def update_temp_async(temp, ts):
        db.reference(TEMP_SENSOR_PATH).update({
            "value": float(temp),
            "timestamp": ts
        })
    
    def update_do_async(do_val, ts):
        db.reference(DO_SENSOR_PATH).update({
            "value": float(do_val),
            "timestamp": ts
        })
    
    def update_heater_async(heater, ts):
        db.reference(HEATER_DEVICE_PATH).update({
            "power_state": "on" if heater else "off",
        })

    def update_cooler_async(cooler, ts):
        db.reference(COOLER_DEVICE_PATH).update({
            "power_state": "on" if cooler else "off",
        })

    def update_aerator_async(aerator, ts):
        db.reference(AERATOR_DEVICE_PATH).update({
            "power_state": "on" if aerator else "off",
        })


    print(f"[Arduino] Received: {line}")
    # Ignore non-JSON lines (Arduino startup logs)
    if not line.startswith("{") or not line.endswith("}"):
        print(f"[Arduino Log] {line}")
        return False

    try:
        parsed = json.loads(line)
        sensors = parsed.get("sensors", {})
        devices_status = parsed.get("devices", {})

        print('[Arduino] Parsed JSON:', parsed)

        if "error" in parsed:
            print(f"[Arduino Error] {parsed['error']}")
            return False

        ts = int(time.time())

        # sensor data firebase updates
        # Temperature
        temp = sensors.get("temp")
        if temp is not None:
            Thread(target=update_temp_async, args=(temp, ts), daemon=True).start()

        # pH
        ph = sensors.get("ph")
        if ph is not None:
            Thread(target=update_ph_async, args=(ph, ts), daemon=True).start()

        # Dissolved Oxygen
        do_val = sensors.get("do")
        if do_val is not None:

            Thread(target=update_do_async, args=(do_val, ts), daemon=True).start()

        print(
            f"[Sensor Data] Temp={temp}°C | pH={ph} | DO={do_val} mg/L"
        )


        # devices status data firebase updates
        # Heater
        heater = devices_status.get("heater")
        if heater is not None:
            
            Thread(target=update_heater_async, args=(heater, ts), daemon=True).start()

        # Cooler
        cooler = devices_status.get("cooler")
        if cooler is not None:
            Thread(target=update_cooler_async, args=(cooler, ts), daemon=True).start()

        # Aerator
        aerator = devices_status.get("aerator")
        if aerator is not None:
            Thread(target=update_aerator_async, args=(aerator, ts), daemon=True).start()

        print(
            f"[Devices Status Data] Heater={heater} | Cooler={cooler} | Aerator={aerator}"
        )

        return True

    except json.JSONDecodeError:
        print(f"[Error] Invalid JSON received: {line}")
        return False
    except Exception as e:
        print(f"[Error] Failed to process data: {e}")
        return False


def main():
    ser = connect_arduino()
    if ser is None:
        print("Failed to connect to Arduino. Exiting.")
        sys.exit(1)

    print("Listening for Arduino JSON...")

    # Startup fetches
    refresh_feeding_schedules_cache()
    refresh_cleaning_schedules_cache()
    fetch_and_send_opt_ranges_once(ser)

    last_schedule_refresh = time.time()

    try:
        while True:
            now = time.time()

            if now - last_schedule_refresh >= SCHEDULE_REFRESH_SECONDS:
                refresh_feeding_schedules_cache()
                refresh_cleaning_schedules_cache()

                next_cleaning_schedule = get_next_cleaning_schedule(cleaning_schedules_cache)
                if next_cleaning_schedule is None:
                    print("No upcoming cleaning schedule (all disabled or already passed).")
                    continue

                schedule_id, schedule, next_run = next_cleaning_schedule

                if is_cleaning_time_now(next_run, WINDOW_MINUTES):
                    print("Cleaning should run now")
                    send_device_control(ser, "cl", 1)
                else:
                    print("Not cleaning time")

                # send_device_control(ser, "h", 1)

                last_schedule_refresh = now

            if ser.in_waiting:
                line = ser.readline().decode("utf-8", errors="replace").strip()
                if line:
                    process_sensor_data(line)

            time.sleep(0.05)

    except KeyboardInterrupt:
        print("\nShutting down...")
        try:

            ser.close()
        except Exception:
            pass
        sys.exit(0)


if __name__ == "__main__":
    main()
