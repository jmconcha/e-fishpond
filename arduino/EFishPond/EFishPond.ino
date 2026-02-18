#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
#include <Arduino.h>
#include <ArduinoJson.h>

// -------------------- Pin definitions --------------------
#define ONE_WIRE_BUS 2
#define RELAY_OFF HIGH
#define RELAY_ON  LOW
#define HEATER_PIN 8
#define AERATOR_PIN 9
#define COOLER_PUMP_PIN 10
#define COOLER_PIN 11
#define CLEANER_PIN 12
#define FEEDER_PIN 13

#define PH_PIN A0
#define DO_PIN A1

#define BAUD_RATE 9600

// -------------------- optimal water temperature range --------------------
#define TEMP_MIN 28.0  // °C
#define TEMP_MAX 32.0  // °C
#define OPT_TEMP (TEMP_MIN + ((TEMP_MAX - TEMP_MIN) / 2.0))

// -------------------- optimal dissolved oxygen level range --------------------
#define DO_MIN 5.0  // mg/L
#define DO_MAX 8.0  // mg/L
#define OPT_DO (DO_MIN + ((DO_MAX - DO_MIN) / 2.0))

// -------------------- devices power state --------------------
// heater
#define DEVICE_ON  1
#define DEVICE_OFF  0
int heaterState = DEVICE_OFF;
// cooler
int coolerState = DEVICE_OFF;
// aerator
int aeratorState = DEVICE_OFF;
// cleaner
int cleanerState = DEVICE_OFF;
// feeder
int feederState = DEVICE_OFF;

// -------------------- Cleaner auto-off timer --------------------
const unsigned long CLEANER_RUN_DURATION_MS = 60UL * 60UL * 1000UL; // 1 hour
bool cleanerTimedRunActive = false;
unsigned long cleanerStartTime = 0;

// -------------------- Send interval --------------------
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 5000; // 5 seconds

// -------------------- DS18B20 setup --------------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

bool sensorFound = false;
DeviceAddress sensorAddress;

// -------------------- pH sensor calibration --------------------
float calibration_value = 21.34 + 1.6;  // adjust as needed

// -------------------- DO sensor constants (from your code) --------------------
#define VREF 5000      // mV (UNO 5V)
#define ADC_RES 1024   // 10-bit ADC

// Single-point calibration Mode=0, Two-point Mode=1
#define TWO_POINT_CALIBRATION 0

// Single point calibration values
#define CAL1_V (1455) // mV
#define CAL1_T (25)   // °C

// Two-point calibration values (only used if TWO_POINT_CALIBRATION=1)
#define CAL2_V (1300) // mV
#define CAL2_T (15)   // °C

const uint16_t DO_Table[41] = {
  14460, 14220, 13820, 13440, 13090, 12740, 12420, 12110, 11810, 11530,
  11260, 11010, 10770, 10530, 10300, 10080,  9860,  9660,  9460,  9270,
   9080,  8900,  8730,  8570,  8410,  8250,  8110,  7960,  7820,  7690,
   7560,  7430,  7300,  7180,  7070,  6950,  6840,  6730,  6630,  6530,
   6410
};

int16_t readDO(uint32_t voltage_mv, uint8_t temperature_c)
{
#if TWO_POINT_CALIBRATION == 0
  uint16_t V_saturation =
    (uint32_t)CAL1_V + (uint32_t)35 * temperature_c - (uint32_t)CAL1_T * 35;
  return (voltage_mv * DO_Table[temperature_c] / V_saturation);
#else
  uint16_t V_saturation =
    (int16_t)((int8_t)temperature_c - CAL2_T) *
      ((uint16_t)CAL1_V - CAL2_V) /
      ((uint8_t)CAL1_T - CAL2_T) + CAL2_V;
  return (voltage_mv * DO_Table[temperature_c] / V_saturation);
#endif
}

float readDissolvedOxygenMgL(uint8_t tempC)
{
  // Clamp temperature to 0..40 because DO_Table has 41 entries (0-40)
  if (tempC > 40) tempC = 40;

  uint16_t adcRaw = analogRead(DO_PIN);
  uint16_t adcVoltage = (uint32_t)VREF * adcRaw / ADC_RES; // mV

  // readDO returns a value like 8xxx meaning 8.xxx mg/L * 1000
  int16_t do_x1000 = readDO(adcVoltage, tempC);

  // Convert to mg/L
  return (float)do_x1000 / 1000.0;
}

// -------------------- Helpers --------------------
float readPH()
{
  int buffer_arr[10];
  int temp;

  for (int i = 0; i < 10; i++) {
    buffer_arr[i] = analogRead(PH_PIN);
    delay(30);
  }

  for (int i = 0; i < 9; i++) {
    for (int j = i + 1; j < 10; j++) {
      if (buffer_arr[i] > buffer_arr[j]) {
        temp = buffer_arr[i];
        buffer_arr[i] = buffer_arr[j];
        buffer_arr[j] = temp;
      }
    }
  }

  unsigned long avgval = 0;
  for (int i = 2; i < 8; i++) avgval += buffer_arr[i];

  float volt = (float)avgval * 5.0 / 1023.0 / 6.0;
  float ph_act = -5.70 * volt + calibration_value;

  return ph_act;
}

bool readTemperature(float &tempOut)
{
  sensors.requestTemperatures();
  delay(750);

  float temp = sensors.getTempC(sensorAddress);

  if (temp == 85.0) {
    Serial.println("TEMP ERROR: DS18B20 code 85 (sensor not ready)");
    return false;
  }
  if (temp == -127.0) {
    Serial.println("TEMP ERROR: DS18B20 code -127 (sensor not connected)");
    return false;
  }

  tempOut = temp;
  return true;
}

void controlHeater(int powerState)
{
  if (powerState == 1) {
    digitalWrite(HEATER_PIN, RELAY_ON);
    heaterState = DEVICE_ON;
  } else {
    digitalWrite(HEATER_PIN, RELAY_OFF);
    heaterState = DEVICE_OFF;
  }
}

void controlCooler(int powerState)
{
  if (powerState == 1) {
    digitalWrite(COOLER_PIN, RELAY_ON);
    digitalWrite(COOLER_PUMP_PIN, RELAY_ON);
    coolerState = DEVICE_ON;
  } else {
    digitalWrite(COOLER_PIN, RELAY_OFF);
    digitalWrite(COOLER_PUMP_PIN, RELAY_OFF);
    coolerState = DEVICE_OFF;
  }
}

void controlAerator(int powerState)
{
  if (powerState == 1) {
    digitalWrite(AERATOR_PIN, RELAY_ON);
    aeratorState = DEVICE_ON;
  } else {
    digitalWrite(AERATOR_PIN, RELAY_OFF);
    aeratorState = DEVICE_OFF;
  }
}

void handleCleanerAutoOff()
{
  if (!cleanerTimedRunActive) return;

  unsigned long now = millis();

  // handles millis() overflow safely
  if ((unsigned long)(now - cleanerStartTime) >= CLEANER_RUN_DURATION_MS) {
    controlCleaner(0);              // turn OFF
    cleanerTimedRunActive = false;  // stop timer
    Serial.println("[Cleaner] Auto-OFF after 1 hour");
  }
}

void controlCleaner(int powerState)
{
  if (powerState == 1) {
    digitalWrite(CLEANER_PIN, RELAY_ON);
    cleanerState = DEVICE_ON;

    // start/restart timer on ON
    cleanerStartTime = millis();
    cleanerTimedRunActive = true;

  } else {
    digitalWrite(CLEANER_PIN, RELAY_OFF);
    cleanerState = DEVICE_OFF;

    // cancel timer on OFF
    cleanerTimedRunActive = false;
  }
}

void controlFeeder(int powerState)
{
  if (powerState == 1) {
    digitalWrite(FEEDER_PIN, RELAY_ON);
    feederState = DEVICE_ON;
  } else {
    digitalWrite(FEEDER_PIN, RELAY_OFF);
    feederState = DEVICE_OFF;
  }
}

void sendJson(float temp, float ph, float doMgL, bool tempOk, bool phOk, bool doOk)
{
  Serial.print("{");

  // sensors object
  Serial.print("\"sensors\": {");

  // temp
  Serial.print("\"temp\": ");
  if (tempOk) {
    Serial.print(temp, 2);
  } else {
    Serial.print("null");
  }

  Serial.print(", ");

  // do
  Serial.print("\"do\": ");
  if (doOk) {
    Serial.print(doMgL, 2);
  } else {
    Serial.print("null");
  }

  Serial.print(", ");

  // ph
  Serial.print("\"ph\": ");
  if (phOk) {
    Serial.print(ph, 2);
  } else {
    Serial.print("null");
  }

  Serial.print("}, ");

  // devices object
  Serial.print("\"devices\": {");

  Serial.print("\"heater\": ");
  Serial.print(heaterState);

  Serial.print(", ");

  Serial.print("\"cooler\": ");
  Serial.print(coolerState);

  Serial.print(", ");

  Serial.print("\"aerator\": ");
  Serial.print(aeratorState);

  Serial.print("}");

  Serial.println("}");
}

void readFromPiAndPrint()
{
  if (Serial.available() <= 0) return;

  String msg = Serial.readStringUntil('\n');
  msg.trim();
  if (msg.length() == 0) return;

  Serial.print("[Arduino] Raw received: ");
  Serial.println(msg);

  // Expected format: t=dc,n=h,v=1
  String t = "";
  String n = "";
  int v = -1;

  int start = 0;
  while (start < msg.length())
  {
    int comma = msg.indexOf(',', start);
    if (comma == -1) comma = msg.length();

    String part = msg.substring(start, comma);
    part.trim();

    int eq = part.indexOf('=');
    if (eq != -1)
    {
      String key = part.substring(0, eq);
      String val = part.substring(eq + 1);
      key.trim();
      val.trim();

      if (key == "t") t = val;
      else if (key == "n") n = val;
      else if (key == "v") v = val.toInt();
    }

    start = comma + 1;
  }

  Serial.print("t=");
  Serial.println(t);
  Serial.print("n=");
  Serial.println(n);
  Serial.print("v=");
  Serial.println(v);

  // Handle device control
  if (t == "dc")
  {
    if (n == "h") {
      Serial.println(v == 1 ? "Turning heater ON" : "Turning heater OFF");
      controlHeater(v == 1 ? 1 : 0);
    }
    else if (n == "co") {
      Serial.println(v == 1 ? "Turning cooler ON" : "Turning cooler OFF");
      controlCooler(v == 1 ? 1 : 0);
    }
    else if (n == "a") {
      Serial.println(v == 1 ? "Turning aerator ON" : "Turning aerator OFF");
      controlAerator(v == 1 ? 1 : 0);
    }
    else if (n == "cl") {
      Serial.println(v == 1 ? "Turning cleaner ON" : "Turning cleaner OFF");
      controlCleaner(v == 1 ? 1 : 0);
    }
    else if (n == "f") {
      Serial.println(v == 1 ? "Turning feeder ON" : "Turning feeder OFF");
      controlFeeder(v == 1 ? 1 : 0);
    }
    else {
      Serial.println("Unknown device name");
    }
  }
}

// -------------------- Arduino setup/loop --------------------
void setup()
{
  Serial.begin(BAUD_RATE);
  delay(1000);

  Serial.println("Arduino starting...");

  Wire.begin();
  sensors.begin();

  int deviceCount = sensors.getDeviceCount();
  Serial.print("Found ");
  Serial.print(deviceCount);
  Serial.println(" DS18B20 sensor(s)");

  if (deviceCount > 0) {
    if (sensors.getAddress(sensorAddress, 0)) {
      sensorFound = true;
      sensors.setResolution(sensorAddress, 12);
      Serial.println("DS18B20 initialized successfully");
    } else {
      Serial.println("ERROR: Could not get DS18B20 address");
    }
  } else {
    Serial.println("ERROR: No DS18B20 sensors found");
  }

  // heater
  pinMode(HEATER_PIN, OUTPUT);
  digitalWrite(HEATER_PIN, RELAY_OFF);
  // cooler
  pinMode(COOLER_PIN, OUTPUT);
  digitalWrite(COOLER_PIN, RELAY_OFF);
  // cooler pump
  pinMode(COOLER_PUMP_PIN, OUTPUT);
  digitalWrite(COOLER_PUMP_PIN, RELAY_OFF);
  // aerator
  pinMode(AERATOR_PIN, OUTPUT);
  digitalWrite(AERATOR_PIN, RELAY_OFF);
  // cleaner
  pinMode(CLEANER_PIN, OUTPUT);
  digitalWrite(CLEANER_PIN, RELAY_OFF);

  pinMode(PH_PIN, INPUT);
  pinMode(DO_PIN, INPUT);
}

void loop()
{
  // always check incoming serial data from Pi
  readFromPiAndPrint();

  // always check if cleaner needs to be turned off due to auto-off timer
  handleCleanerAutoOff();

  if (!sensorFound) {
    Serial.println("{\"error\": \"DS18B20 not found\"}");
    delay(2000);
    return;
  }

  unsigned long currentTime = millis();

  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentTime;

    float temp = 0.0;
    float ph = 0.0;
    float doMgL = 0.0;

    // Temp
    bool tempOk = readTemperature(temp);
    if (tempOk) {
      if (temp < TEMP_MIN && heaterState == DEVICE_OFF) {
        controlHeater(1); // ON
      } else if (temp >= OPT_TEMP && heaterState == DEVICE_ON) {
        controlHeater(0); // OFF
      }

      if (temp > TEMP_MAX && coolerState == DEVICE_OFF) {
        controlCooler(1); // ON
      } else if (temp <= OPT_TEMP && coolerState == DEVICE_ON) {
        controlCooler(0); // OFF
      }
    }

    // pH
    ph = readPH();
    bool phOk = !isnan(ph);

    // DO uses temperature if available, else fallback to 25°C
    uint8_t doTempC = tempOk ? (uint8_t)round(temp) : (uint8_t)25;
    doMgL = readDissolvedOxygenMgL(doTempC);
    bool doOk = !isnan(doMgL);

    if (doOk) {
      // Aerator control based on DO levels
      if (doMgL < DO_MIN && aeratorState == DEVICE_OFF) {
        controlAerator(1); // ON
      } else if (doMgL >= OPT_DO && aeratorState == DEVICE_ON) {
        controlAerator(0); // OFF
      }
    }

    sendJson(temp, ph, doMgL, tempOk, phOk, doOk);
  }

  delay(50);
}
