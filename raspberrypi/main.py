import firebase_admin
from firebase_admin import credentials, db
import time
import serial
import json
import sys
from datetime import datetime, timedelta, timezone

# Serial connection settings
SERIAL_PORT = "/dev/ttyUSB0"
BAUD_RATE = 9600

# Firebase node paths
FEEDING_SCHEDULES_PATH = "/feeding_schedules"
CLEANING_SCHEDULES_PATH = "/cleaning_schedules"

# optimal range paths
OPT_RANGE_DO_PATH = "/opt_range_do"
OPT_RANGE_TEMP_PATH = "/opt_range_temp"

# Load credentials
cred = credentials.Certificate("./service_account_key.json")

# Initialize app
firebase_admin.initialize_app(
    cred,
    {
        "databaseURL": "https://e-fishpond-default-rtdb.asia-southeast1.firebasedatabase.app/"
    },
)

# Global cache for schedules (updated periodically)
feeding_schedules_cache = {}
cleaning_schedules_cache = {}

# cache for optimal ranges
opt_ranges_cache = {
    "do": None,    # {"min": 0, "max": 0, "unit": ""}
    "temp": None,  # {"min": 0, "max": 0, "unit": ""}
}


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
    """
    Parse ISO string like '2026-02-03T07:43:00.000Z' into a timezone-aware datetime (UTC).
    Returns None if parsing fails.
    """
    try:
        if not iso_str:
            return None
        # Handle trailing Z (UTC)
        if iso_str.endswith("Z"):
            iso_str = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def compute_next_run(schedule: dict, now_utc: datetime | None = None) -> datetime | None:
    """
    For a schedule with fields:
      - run_at (ISO datetime)
      - repeat_daily (bool)
      - enabled (bool)

    Returns the next datetime this schedule should run (UTC), or None if invalid/disabled.
    """
    if not schedule or schedule.get("enabled") is False:
        return None

    run_at = parse_iso(schedule.get("run_at", ""))
    if run_at is None:
        return None

    repeat_daily = bool(schedule.get("repeat_daily", False))
    now_utc = now_utc or datetime.now(timezone.utc)

    if not repeat_daily:
        # One-time schedule: only if still in the future
        return run_at if run_at > now_utc else None

    # Daily schedule: run every day at the run_at time (hour/minute)
    next_dt = now_utc.replace(hour=run_at.hour, minute=run_at.minute, second=0, microsecond=0)
    if next_dt <= now_utc:
        next_dt += timedelta(days=1)
    return next_dt


def fetch_feeding_schedules() -> dict:
    """
    Fetch schedules from Firebase RTDB path: /feeding_schedules
    Returns a dict keyed by scheduleId.
    """
    try:
        ref_s = db.reference(FEEDING_SCHEDULES_PATH)
        data = ref_s.get() or {}
        if not isinstance(data, dict):
            print("[Schedules] Unexpected data format at /feeding_schedules (expected object).")
            return {}
        return data
    except Exception as e:
        print(f"[Schedules] Failed to fetch schedules: {e}")
        return {}


def get_next_feeding_schedule_from_cache(
    now_utc: datetime | None = None,
) -> tuple[str, dict, datetime] | None:
    """
    Extract the NEXT feeding schedule from feeding_schedules_cache.
    Returns (schedule_id, schedule_dict, next_run_utc) or None if no upcoming schedule.
    """
    global feeding_schedules_cache
    now_utc = now_utc or datetime.now(timezone.utc)
    best = None  # (next_run_dt, schedule_id, schedule_dict)

    for schedule_id, s in (feeding_schedules_cache or {}).items():
        next_run = compute_next_run(s, now_utc=now_utc)
        if next_run is None:
            continue
        if best is None or next_run < best[0]:
            best = (next_run, schedule_id, s)

    if best is None:
        return None

    next_run, schedule_id, schedule = best
    return schedule_id, schedule, next_run


def refresh_feeding_schedules_cache():
    """
    Refresh global cache, print schedules, and print the NEXT upcoming schedule.
    """
    global feeding_schedules_cache
    feeding_schedules_cache = fetch_feeding_schedules()

    print("\n[Schedules] Loaded feeding schedules:")
    if not feeding_schedules_cache:
        print("  (none)")
        print("  Next schedule: None\n")
        return

    now_utc = datetime.now(timezone.utc)

    for schedule_id, s in feeding_schedules_cache.items():
        run_at = s.get("run_at")
        repeat_daily = bool(s.get("repeat_daily", False))
        enabled = s.get("enabled", True)

        next_run = compute_next_run(s, now_utc=now_utc)
        next_run_str = next_run.isoformat() if next_run else "None"

        print(
            f"  - {schedule_id} | enabled={enabled} | repeat_daily={repeat_daily} | "
            f"run_at={run_at} | next_run_utc={next_run_str}"
        )

    # Extract the next schedule from cache
    next_item = get_next_feeding_schedule_from_cache(now_utc=now_utc)
    if next_item is None:
        print("  Next schedule: None\n")
        return

    next_id, next_schedule, next_run = next_item
    
    utc_time = next_run.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    local_time = next_run.astimezone().strftime("%Y-%m-%d %I:%M %p (local)")

    print(
        f"  Next schedule: {next_id} | "
        f"next_run_utc={utc_time} | "
        f"next_run_local={local_time} | "
        f"repeat_daily={bool(next_schedule.get('repeat_daily', False))} | "
        f"enabled={next_schedule.get('enabled', True)}"
    )

    print("")


def fetch_cleaning_schedules() -> dict:
    """
    Fetch schedules from Firebase RTDB path: /cleaning_schedules
    Returns a dict keyed by scheduleId.
    """
    try:
        ref_s = db.reference(CLEANING_SCHEDULES_PATH)
        data = ref_s.get() or {}
        if not isinstance(data, dict):
            print("[Cleaning] Unexpected data format at /cleaning_schedules.")
            return {}
        return data
    except Exception as e:
        print(f"[Cleaning] Failed to fetch schedules: {e}")
        return {}


def get_next_cleaning_schedule_from_cache(
    now_utc: datetime | None = None,
) -> tuple[str, dict, datetime] | None:
    """
    Extract the NEXT cleaning schedule from cleaning_schedules_cache.
    Returns (schedule_id, schedule_dict, next_run_utc) or None.
    """
    global cleaning_schedules_cache
    now_utc = now_utc or datetime.now(timezone.utc)
    best = None  # (next_run_dt, schedule_id, schedule_dict)

    for schedule_id, s in (cleaning_schedules_cache or {}).items():
        next_run = compute_next_run(s, now_utc=now_utc)
        if next_run is None:
            continue
        if best is None or next_run < best[0]:
            best = (next_run, schedule_id, s)

    if best is None:
        return None

    next_run, schedule_id, schedule = best
    return schedule_id, schedule, next_run


def refresh_cleaning_schedules_cache():
    """
    Refresh cleaning schedules cache and print next upcoming cleaning schedule.
    """
    global cleaning_schedules_cache
    cleaning_schedules_cache = fetch_cleaning_schedules()

    print("\n[Cleaning Schedules] Loaded cleaning schedules:")
    if not cleaning_schedules_cache:
        print("  (none)")
        print("  Next cleaning schedule: None\n")
        return

    now_utc = datetime.now(timezone.utc)

    for schedule_id, s in cleaning_schedules_cache.items():
        next_run = compute_next_run(s, now_utc=now_utc)
        next_run_str = next_run.isoformat() if next_run else "None"

        print(
            f"  - {schedule_id} | enabled={s.get('enabled', True)} | "
            f"repeat_daily={bool(s.get('repeat_daily', False))} | "
            f"run_at={s.get('run_at')} | next_run_utc={next_run_str}"
        )

    next_item = get_next_cleaning_schedule_from_cache(now_utc=now_utc)
    if next_item is None:
        print("  Next cleaning schedule: None\n")
        return

    next_id, next_schedule, next_run = next_item

    utc_time = next_run.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    local_time = next_run.astimezone().strftime("%Y-%m-%d %I:%M %p (local)")

    print(
        f"  Next cleaning schedule: {next_id} | "
        f"next_run_utc={utc_time} | "
        f"next_run_local={local_time} | "
        f"repeat_daily={bool(next_schedule.get('repeat_daily', False))} | "
        f"enabled={next_schedule.get('enabled', True)}"
    )
    print("")


# -----------------------------
# Fetch optimal ranges + send to Arduino
# -----------------------------
def _normalize_opt_range(node_value: object, label: str) -> dict | None:
    """
    Ensure node_value looks like {"min": number, "max": number, "unit": str}
    Returns normalized dict or None.
    """
    if not isinstance(node_value, dict):
        print(f"[OptRange] {label}: unexpected format (expected object). Got: {type(node_value)}")
        return None

    try:
        min_v = float(node_value.get("min"))
        max_v = float(node_value.get("max"))
        unit = str(node_value.get("unit", "")).strip()
        if unit == "":
            unit = "N/A"
        return {"min": min_v, "max": max_v, "unit": unit}
    except Exception:
        print(f"[OptRange] {label}: invalid min/max/unit in: {node_value}")
        return None


def fetch_optimal_ranges() -> tuple[dict | None, dict | None]:
    """
    Fetch both:
      - /opt_range_do
      - /opt_range_temp
    Returns (do_range, temp_range) normalized dicts or None.
    """
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
    """
    Send optimal ranges to Arduino via serial as one JSON message.
    Arduino should parse it and apply thresholds.
    """
    if ser is None:
        return

    payload = {
        "type": "opt_ranges",
        "timestamp": int(time.time()),
        "do": do_range,         # {"min": 0, "max": 0, "unit": ""} or None
        "temp": temp_range,     # {"min": 0, "max": 0, "unit": ""} or None
    }

    msg = json.dumps(payload) + "\n"
    try:
        ser.write(msg.encode("utf-8"))
        ser.flush()
        print("[Arduino] Sent optimal ranges:", payload)
    except Exception as e:
        print(f"[Arduino] Failed to send optimal ranges: {e}")


def fetch_and_send_opt_ranges_once(ser: serial.Serial | None):
    do_range, temp_range = fetch_optimal_ranges()

    print("\n[OptRange] Loaded optimal ranges from Firebase:")
    print(f"  DO:   {do_range}")
    print(f"  TEMP: {temp_range}\n")

    if ser is not None:
        send_opt_ranges_to_arduino(ser, do_range, temp_range)



# -----------------------------
# Existing: process sensor data (optional)
# -----------------------------
def process_sensor_data(data):
    """Process and validate sensor data from Arduino"""
    try:
        parsed = json.loads(data)

        if "error" in parsed:
            print(f"[Arduino Error] {parsed['error']}")
            return False

        if "temp" in parsed:
            temp = parsed["temp"]
            heater = parsed["heater"]

            # Update Firebase with temperature data
            ref_t = db.reference("/sensors/water_temperature")
            ref_t.set({"value": temp, "unit": "°C", "timestamp": int(time.time())})

            # Update heater status
            heater_ref = db.reference("/devices/heater")
            heater_ref.set({"status": "ON" if heater else "OFF", "timestamp": int(time.time())})

            print(f"[Sensor Data] Temp: {temp}°C | Heater: {'ON' if heater else 'OFF'}")
            return True

    except json.JSONDecodeError:
        print(f"[Error] Invalid JSON received: {data}")
        return False
    except Exception as e:
        print(f"[Error] Failed to process data: {e}")
        return False


def main():
    """Main loop to read from Arduino, update Firebase, and periodically fetch feeding schedules."""
    # Uncomment this when running on Raspberry Pi
    # ser = connect_arduino()

    # Uncomment this block when running on Raspberry Pi
    # if ser is None:
    #     print("Failed to connect to Arduino. Exiting.")
    #     sys.exit(1)

    # Uncomment this when running on Raspberry Pi
    # print("Listening for sensor data from Arduino...")

    # Load schedules on startup
    refresh_feeding_schedules_cache()
    refresh_cleaning_schedules_cache()
    fetch_and_send_opt_ranges_once(ser)

    SCHEDULE_REFRESH_SECONDS = 10

    last_schedule_refresh = time.time()

    print("Running... (polling schedules + optimal ranges)\n")

    try:
        while True:
            now = time.time()

            if now - last_schedule_refresh >= SCHEDULE_REFRESH_SECONDS:
                refresh_feeding_schedules_cache()
                refresh_cleaning_schedules_cache()
                last_schedule_refresh = now

            # read Arduino messages (sensor data, logs, etc.)
            # if ser.in_waiting:
            #     try:
            #         line = ser.readline().decode("utf-8", errors="replace").strip()
            #         if line:
            #             # If Arduino sends JSON sensor data, this will handle it
            #             process_sensor_data(line)
            #     except Exception as e:
            #         print(f"[Warning] Serial read error: {e}")

            time.sleep(0.1)

    except KeyboardInterrupt:
        print("\nShutting down...")
        try:
            ser.close()
        except Exception:
            pass
        sys.exit(0)
    except Exception as e:
        print(f"[Error] {e}")
        try:
            ser.close()
        except Exception:
            pass
        sys.exit(1)


if __name__ == "__main__":
    main()
