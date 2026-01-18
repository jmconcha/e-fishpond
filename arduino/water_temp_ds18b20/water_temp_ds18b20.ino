#include <OneWire.h>
#include <DallasTemperature.h>
#include <Wire.h>
// Data wire is plugged into digital pin 2 on the Arduino
#define ONE_WIRE_BUS 2
// Setup a oneWire instance to communicate with any OneWire device
OneWire oneWire(ONE_WIRE_BUS);  
// Pass oneWire reference to DallasTemperature library
DallasTemperature sensors(&oneWire);
void setup(void)
{
  Serial.begin(9600);
  sensors.begin();  
}
void loop(void)
{ 
  sensors.requestTemperatures(); 
  delay(750);
  Serial.print("temp: ");
  Serial.println(sensors.getTempCByIndex(0));
  delay(1000);
}

