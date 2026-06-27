/**
 * MEDIGUARDIAN AI - PATIENT DATA SERVICE
 * Manages default patient profiles, dynamic risk/conditions enrichment,
 * and handles dispatching patient state events.
 */

window.PATIENT_PROFILES = {
  diabetic: {
    name: 'Diabetic Patient',
    gender: 'Male',
    blood_sugar: 186,
    hba1c: 8.4,
    cholesterol: 210,
    hdl: 38,
    ldl: 145,
    haemoglobin: 12.8,
    bmi: 29.4,
    vitamin_d: 18,
    daily_calories: 1600,
    conditions: ['Type 2 Diabetes Mellitus', 'Pre-hypertension', 'Vitamin D Deficiency'],
    risks: {
      diabetes: 85,
      cardiovascular: 55,
      obesity: 48,
      nutritional: 65
    }
  },
  cardiac: {
    name: 'Cardiac Risk Patient',
    gender: 'Female',
    blood_sugar: 98,
    hba1c: 5.6,
    cholesterol: 278,
    hdl: 32,
    ldl: 198,
    haemoglobin: 11.2,
    bmi: 32.1,
    vitamin_d: 22,
    daily_calories: 1500,
    conditions: ['Hypercholesterolaemia', 'Obesity', 'Mild Anaemia'],
    risks: {
      diabetes: 15,
      cardiovascular: 90,
      obesity: 75,
      nutritional: 40
    }
  },
  healthy: {
    name: 'Healthy Patient',
    gender: 'Female',
    blood_sugar: 88,
    hba1c: 5.1,
    cholesterol: 165,
    hdl: 58,
    ldl: 95,
    haemoglobin: 13.5,
    bmi: 22.4,
    vitamin_d: 42,
    daily_calories: 2000,
    conditions: [],
    risks: {
      diabetes: 5,
      cardiovascular: 10,
      obesity: 5,
      nutritional: 8
    }
  }
};

/**
 * Enriches raw diagnostic metrics with calculated risk percentages and medical conditions.
 * Used for dynamic RAG-parsed report uploads.
 * @param {object} raw 
 * @returns {object} Enriched patient object
 */
function enrichPatientData(raw) {
  // Safe parsing & default fallbacks
  const p = {
    name: raw.name || 'Patient Profile',
    gender: raw.gender || 'Male',
    blood_sugar: raw.blood_sugar !== undefined ? parseFloat(raw.blood_sugar) : 90,
    hba1c: raw.hba1c !== undefined ? parseFloat(raw.hba1c) : 5.4,
    cholesterol: raw.cholesterol !== undefined ? parseFloat(raw.cholesterol) : 180,
    hdl: raw.hdl !== undefined ? parseFloat(raw.hdl) : 50,
    ldl: raw.ldl !== undefined ? parseFloat(raw.ldl) : 100,
    haemoglobin: raw.haemoglobin !== undefined ? parseFloat(raw.haemoglobin) : 14.0,
    bmi: raw.bmi !== undefined ? parseFloat(raw.bmi) : 23.5,
    vitamin_d: raw.vitamin_d !== undefined ? parseFloat(raw.vitamin_d) : 35,
    conditions: raw.conditions || [],
    risks: raw.risks || {}
  };

  // 1. Calculate Diabetes Risk
  if (p.risks.diabetes === undefined) {
    const sugarRisk = p.blood_sugar >= 126 ? 85 : p.blood_sugar >= 100 ? 45 : 10;
    const a1cRisk = p.hba1c >= 6.5 ? 90 : p.hba1c >= 5.7 ? 50 : 10;
    p.risks.diabetes = Math.max(sugarRisk, a1cRisk);
  }

  // 2. Calculate Cardiovascular Risk
  if (p.risks.cardiovascular === undefined) {
    const cholRisk = p.cholesterol >= 240 ? 80 : p.cholesterol >= 200 ? 45 : 15;
    const ldlRisk = p.ldl >= 160 ? 85 : p.ldl >= 130 ? 50 : 15;
    const hdlRisk = p.hdl < 40 ? 60 : 10;
    p.risks.cardiovascular = Math.max(cholRisk, ldlRisk, hdlRisk);
  }

  // 3. Calculate Obesity Risk
  if (p.risks.obesity === undefined) {
    p.risks.obesity = p.bmi >= 30 ? 85 : p.bmi >= 25 ? 50 : p.bmi >= 18.5 ? 10 : 25;
  }

  // 4. Calculate Nutritional Deficiency Risk
  if (p.risks.nutritional === undefined) {
    const vitDRisk = p.vitamin_d < 20 ? 80 : p.vitamin_d <= 30 ? 45 : 10;
    const hbRisk = p.haemoglobin < 12 ? 60 : 10;
    p.risks.nutritional = Math.max(vitDRisk, hbRisk);
  }

  // 5. Populate Conditions list if empty
  if (p.conditions.length === 0) {
    if (p.blood_sugar >= 126 || p.hba1c >= 6.5) {
      p.conditions.push('Type 2 Diabetes Mellitus');
    } else if (p.blood_sugar >= 100 || p.hba1c >= 5.7) {
      p.conditions.push('Prediabetes');
    }

    if (p.cholesterol >= 240 || p.ldl >= 160) {
      p.conditions.push('Hypercholesterolaemia');
    }

    if (p.bmi >= 30) {
      p.conditions.push('Obesity');
    } else if (p.bmi >= 25) {
      p.conditions.push('Overweight');
    }

    if (p.vitamin_d < 20) {
      p.conditions.push('Vitamin D Deficiency');
    }

    if (p.haemoglobin < 12) {
      p.conditions.push('Mild Anaemia');
    }
  }

  // 6. Calculate daily calories target
  if (p.daily_calories === undefined) {
    if (p.bmi >= 27) {
      p.daily_calories = 1500;
    } else if (p.blood_sugar >= 126) {
      p.daily_calories = 1600;
    } else {
      p.daily_calories = 1800;
    }
  }

  return p;
}

/**
 * Global function called to change active patient profile.
 * Triggers document updates on other sections.
 * @param {object} patient 
 */
function setPatient(patient) {
  const enriched = enrichPatientData(patient);
  window.currentPatient = enriched;
  
  console.log("MediGuardian Patient State Loaded:", enriched);
  
  // Dispatch custom event to notify other modules (Analysis, Nutrition, Food Order, Profile)
  const event = new CustomEvent('patientLoaded', { detail: enriched });
  window.dispatchEvent(event);
}

// Set global scope accessors
window.setPatient = setPatient;
