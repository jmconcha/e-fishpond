void  setup() {
  pinMode(8, OUTPUT);
  digitalWrite(8, LOW);
  //digitalWrite(8, HIGH);
  
}

void  loop() {
  delay(3000);
  digitalWrite(8, HIGH);
  delay(3000);
  digitalWrite(8, LOW);

}
