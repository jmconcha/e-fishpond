#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>

// Pin definitions
#define ONE_WIRE_BUS 2
#define RELAY_OFF HIGH
#define RELAY_ON LOW
#define HEATER_PIN 8
#define BAUD_RATE 9600

// Global variables
bool heaterState = LOW;
bool sensorFound = false;
DeviceAddress sensorAddress;
unsigned long lastSendTime = 0;
const unsigned long SEND_INTERVAL = 5000; // Send data every 5 seconds

// Setup a oneWire instance to communicate with any OneWire device
OneWire oneWire(ONE_WIRE_BUS);  
// Pass oneWire reference to DallasTemperature library
DallasTemperature sensors(&oneWire);
void setup()
{
  Serial.begin(BAUD_RATE);
  delay(1000); // Wait for serial connection to establish
  
  Serial.println("Arduino starting...");
  
  sensors.begin();
  
  // Search for DS18B20 sensor
  int deviceCount = sensors.getDeviceCount();
  Serial.print("Found ");
  Serial.print(deviceCount);
  Serial.println(" DS18B20 sensor(s)");
  
  if (deviceCount > 0) {
    // Get the address of the first sensor
    if (sensors.getAddress(sensorAddress, 0)) {
      sensorFound = true;
      sensors.setResolution(sensorAddress, 12);
      Serial.println("Sensor initialized successfully");
    } else {
      Serial.println("ERROR: Could not get sensor address");
    }
  } else {
    Serial.println("ERROR: No DS18B20 sensors found");
  }

  pinMode(HEATER_PIN, OUTPUT);
  digitalWrite(HEATER_PIN, RELAY_OFF);
}

void loop()
{ 
  if (!sensorFound) {
    Serial.println("Waiting for sensor...");
    delay(2000);
    return;
  }
  
  unsigned long currentTime = millis();
  
  // Read temperature and send to Raspberry Pi at regular intervals
  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentTime;
    readAndSendTemperature();
  }
  
  delay(100);
}

void readAndSendTemperature(void)
{
  sensors.requestTemperatures();
  delay(750); // Wait for temperature conversion
  
  float temp = sensors.getTempC(sensorAddress);
  
  // Validate temperature reading
  if (temp == -127.0 || temp == 85.0) {
    Serial.println("{\"error\": \"Sensor error\"}");
    return;
  }
  
  // Control heater based on temperature
  if (temp < 29) {
    digitalWrite(HEATER_PIN, RELAY_ON); // Turn heater ON
    heaterState = RELAY_ON;
  } else if (temp >= 29) {
    digitalWrite(HEATER_PIN, RELAY_OFF); // Turn heater OFF
    heaterState = RELAY_OFF;
  }
  
  // Send temperature data to Raspberry Pi in JSON format
  Serial.print("{\"temp\": ");
  Serial.print(temp);
  Serial.print(", \"heater\": ");
  Serial.print(heaterState == RELAY_ON ? "true" : "false");
  Serial.println("}");
}
