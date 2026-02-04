#include <Wire.h>
#include <SimpleTimer.h>

SimpleTimer timer;

//float calibration_value = 21.34 - 0.7;
float calibration_value = 21.34 + 1.6;
int phval = 0;
unsigned long int avgval;
int buffer_arr[10], temp;

float ph_act;

void display_pHValue() {
  
}

void setup() {
  Wire.begin();
  Serial.begin(9600);

<<<<<<< Updated upstream
  lcd.init();         // initialize the lcd
  lcd.backlight();    // Turn on the LCD screen backlight

  timer.setInterval(500L, display_pHValue);
}

void loop() {
  timer.run();  // Initiates SimpleTimer
=======
//  timer.setInterval(500L, display_pHValue);
}

void loop() {
//  timer.run();  // Initiates SimpleTimer
>>>>>>> Stashed changes
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

  Serial.print("pH Val: ");
  Serial.println(ph_act);
  delay(1000);
}

