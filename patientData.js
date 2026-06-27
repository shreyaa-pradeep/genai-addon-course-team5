// SHARED PATIENT DATA FILE — owned by Kadeeja
// Everyone else only READS from currentPatient
// Only Kadeeja's upload section calls setPatient()

let currentPatient = null;

function setPatient(data) {
  currentPatient = data;
  window.currentPatient = data;
  // Fire event so other sections know data is ready
  window.dispatchEvent(new CustomEvent('patientLoaded', { detail: data }));
}

// Fallback synthetic profiles (used by sample buttons)
const PATIENT_PROFILES = {
  diabetic: {
    name: "Demo User",
    age: 45,
    gender: "Male",
    blood_type: "B+",
    blood_sugar: 186,
    hba1c: 8.4,
    cholesterol: 210,
    hdl: 38,
    ldl: 145,
    haemoglobin: 12.8,
    bmi: 29.4,
    vitamin_d: 18,
    blood_pressure: "138/88",
    conditions: ["Type 2 Diabetes", "Pre-hypertension", "Vitamin D Deficiency"],
    risks: { diabetes: 88, cardiovascular: 62, obesity: 55, nutritional: 70 },
    daily_calories: 1800,
    sample_type: "diabetic"
  },
  cardiac: {
    name: "Demo User",
    age: 52,
    gender: "Female",
    blood_type: "O+",
    blood_sugar: 98,
    hba1c: 5.6,
    cholesterol: 278,
    hdl: 32,
    ldl: 198,
    haemoglobin: 11.2,
    bmi: 32.1,
    vitamin_d: 22,
    blood_pressure: "145/92",
    conditions: ["High Cholesterol", "Obesity", "Mild Anaemia"],
    risks: { diabetes: 35, cardiovascular: 85, obesity: 80, nutritional: 55 },
    daily_calories: 1600,
    sample_type: "cardiac"
  },
  healthy: {
    name: "Demo User",
    age: 28,
    gender: "Female",
    blood_type: "A+",
    blood_sugar: 88,
    hba1c: 5.1,
    cholesterol: 165,
    hdl: 58,
    ldl: 95,
    haemoglobin: 13.5,
    bmi: 22.4,
    vitamin_d: 42,
    blood_pressure: "112/72",
    conditions: [],
    risks: { diabetes: 12, cardiovascular: 10, obesity: 8, nutritional: 15 },
    daily_calories: 2000,
    sample_type: "healthy"
  }
};

// Expose variables on window for shared team access
window.currentPatient = currentPatient;
window.setPatient = setPatient;
window.PATIENT_PROFILES = PATIENT_PROFILES;
