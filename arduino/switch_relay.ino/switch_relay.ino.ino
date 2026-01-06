//Control an electric solenoid air valve with a 1-channel relay module

void  setup() {
  
  pinMode(8, OUTPUT);
  digitalWrite(8, LOW);
  
}

void  loop() {
  
  delay(3000);
  digitalWrite(8, HIGH);
  delay(1000);
  digitalWrite(8, LOW);

}