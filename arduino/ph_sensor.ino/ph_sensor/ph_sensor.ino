#include <Wire.h>
#include <LiquidCrystal_I2C.h>
// #include <Adafruit_GFX.h>
// #include <Adafruit_SSD1306.h>
#include <SimpleTimer.h>

SimpleTimer timer;
LiquidCrystal_I2C lcd(0x27, 16, 2); // set the LCD address to 0x27 for a 16 chars and 2 line display

// float calibration_value = 21.34 - 0.7;
float calibration_value = 23.31;
int phval = 0;
unsigned long int avgval;
int buffer_arr[10], temp;

float ph_act;
// for the OLED display

// #define SCREEN_WIDTH 128  // OLED display width, in pixels
// #define SCREEN_HEIGHT 64  // OLED display height, in pixels

// Declaration for an SSD1306 display connected to I2C (SDA, SCL pins)
// #define OLED_RESET -1  // Reset pin # (or -1 if sharing Arduino reset pin)
// Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


void display_pHValue() {
  // display on Oled display

  // Oled display
  // display.clearDisplay();
  // display.setTextSize(2);
  // display.setCursor(0, 0);  // column row
  // display.print("pH:");

  // display.setTextSize(2);
  // display.setCursor(55, 0);
  // display.print(ph_act);

  /*
    display.setTextSize(2);
  display.setCursor(0,30);
  display.print("EC:");

  display.setTextSize(2);
  display.setCursor(60, 30);
  display.print(345);
  display.setCursor(95, 50);
*/
  // display.display();
}

void setup() {
  Wire.begin();
  Serial.begin(9600);
  // display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  // display.clearDisplay();
  // display.setTextColor(WHITE);

  lcd.init();         // initialize the lcd
  lcd.backlight();    // Turn on the LCD screen backlight

  // timer.setInterval(500L, display_pHValue);
}

void loop() {
  // timer.run();  // Initiates SimpleTimer
  for (int i = 0; i < 10; i++) {
    buffer_arr[i] = analogRead(A0);
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
  avgval = 0;
  for (int i = 2; i < 8; i++)
    avgval += buffer_arr[i];
  float volt = (float)avgval * 5.0 / 1024 / 6;
  ph_act = -5.70 * volt + calibration_value;

  Serial.println("pH Val: ");
  Serial.println(ph_act);
  lcd.setCursor(1, 0);
  lcd.print("pH: ");
  lcd.print(ph_act);
  delay(1000);
  lcd.clear();
}



























