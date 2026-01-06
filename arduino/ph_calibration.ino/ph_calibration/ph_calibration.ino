#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); // set the LCD address to 0x27 for a 16 chars and 2 line display
int pH_Value; 
float Voltage;

void setup() 
{ 
  lcd.init();         // initialize the lcd
  lcd.backlight();    // Turn on the LCD screen backlight
  // Serial.begin(9600);
  pinMode(pH_Value, INPUT); 
  
} 
 
void loop() 
{ 
  pH_Value = analogRead(A0); 
  Voltage = pH_Value * (5.0 / 1023.0); 
  // Serial.println(pH_Value); 
  // Serial.println(Voltage); 
  // delay(500);
  lcd.setCursor(1, 0);
  lcd.print("Voltage: ");
  lcd.print(Voltage);
  delay(500);
  lcd.clear();
}