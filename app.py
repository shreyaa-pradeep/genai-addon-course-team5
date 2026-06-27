from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz # PyMuPDF
import re
import os

app = Flask(__name__)
CORS(app)

vector_index = None

# Try importing LlamaIndex (graceful fallback if not installed)
try:
    from llama_index.core import VectorStoreIndex, Document
    from llama_index.embeddings.huggingface import HuggingFaceEmbedding
    LLAMA_AVAILABLE = True
except ImportError:
    LLAMA_AVAILABLE = False
    print("LlamaIndex not available — using regex extraction only")

SAMPLE_REPORTS = {
    'diabetic': """
        PATIENT MEDICAL REPORT
        Age: 45 | Gender: Male | Blood Type: B+
        Fasting Blood Glucose: 186 mg/dL
        HbA1c: 8.4%
        Total Cholesterol: 210 mg/dL
        HDL Cholesterol: 38 mg/dL
        LDL Cholesterol: 145 mg/dL
        Haemoglobin: 12.8 g/dL
        BMI: 29.4
        Vitamin D: 18 ng/mL
        Blood Pressure: 138/88 mmHg
        DIAGNOSIS: Type 2 Diabetes Mellitus, Pre-hypertension, Vitamin D Deficiency
    """,
    'cardiac': """
        PATIENT MEDICAL REPORT
        Age: 52 | Gender: Female | Blood Type: O+
        Fasting Blood Glucose: 98 mg/dL
        HbA1c: 5.6%
        Total Cholesterol: 278 mg/dL
        HDL Cholesterol: 32 mg/dL
        LDL Cholesterol: 198 mg/dL
        Haemoglobin: 11.2 g/dL
        BMI: 32.1
        Vitamin D: 22 ng/mL
        Blood Pressure: 145/92 mmHg
        DIAGNOSIS: Hypercholesterolaemia, Obesity, Mild Anaemia
    """,
    'healthy': """
        PATIENT MEDICAL REPORT
        Age: 28 | Gender: Female | Blood Type: A+
        Fasting Blood Glucose: 88 mg/dL
        HbA1c: 5.1%
        Total Cholesterol: 165 mg/dL
        HDL Cholesterol: 58 mg/dL
        LDL Cholesterol: 95 mg/dL
        Haemoglobin: 13.5 g/dL
        BMI: 22.4
        Vitamin D: 42 ng/mL
        Blood Pressure: 112/72 mmHg
        DIAGNOSIS: No significant findings.
    """
}

def extract_health_values(text):
    patterns = {
        'blood_sugar': r'(?:fasting\s+)?(?:blood\s+)?(?:glucose|sugar)[:\s]+(\d+\.?\d*)',
        'hba1c': r'hba1c[:\s]+(\d+\.?\d*)',
        'cholesterol': r'(?:total\s+)?cholesterol[:\s]+(\d+\.?\d*)',
        'hdl': r'hdl[:\s]+(\d+\.?\d*)',
        'ldl': r'ldl[:\s]+(\d+\.?\d*)',
        'haemoglobin': r'h(?:a)?emoglobin[:\s]+(\d+\.?\d*)',
        'bmi': r'bmi[:\s]+(\d+\.?\d*)',
        'vitamin_d': r'vitamin\s+d[:\s]+(\d+\.?\d*)',
    }
    results = {}
    text_lower = text.lower()
    for key, pattern in patterns.items():
        match = re.search(pattern, text_lower)
        if match:
            results[key] = float(match.group(1))
    
    # Calculate derived fields
    bs = results.get('blood_sugar', 90)
    chol = results.get('cholesterol', 170)
    bmi = results.get('bmi', 22)
    vd = results.get('vitamin_d', 35)
    hba1c = results.get('hba1c', 5.0)
    ldl = results.get('ldl', 100)

    results['risks'] = {
        'diabetes': min(100, int((bs - 70) / 1.3)) if bs > 100 else 10,
        'cardiovascular': min(100, int((chol - 150) / 1.3)) if chol > 150 else 10,
        'obesity': min(100, int((bmi - 18) * 5)) if bmi > 25 else 8,
        'nutritional': 75 if vd < 20 else (40 if vd < 30 else 15)
    }
    results['conditions'] = []
    if bs > 126 or hba1c > 6.5:
        results['conditions'].append('Type 2 Diabetes')
    if bs > 100 or hba1c > 5.7:
        results['conditions'].append('Pre-diabetes')
    if chol > 240 or ldl > 160:
        results['conditions'].append('High Cholesterol')
    if bmi > 30:
        results['conditions'].append('Obesity')
    if bmi > 25:
        results['conditions'].append('Overweight')
    if vd < 20:
        results['conditions'].append('Vitamin D Deficiency')

    results['daily_calories'] = 1600 if bmi > 30 else (1800 if bmi > 25 else 2000)
    
    # Parse demographic info if possible, otherwise use standard defaults
    # Age:
    age_match = re.search(r'age[:\s]+(\d+)', text_lower)
    results['age'] = int(age_match.group(1)) if age_match else 45
    # Gender:
    gender_match = re.search(r'gender[:\s]+(male|female|other)', text_lower)
    results['gender'] = gender_match.group(1).capitalize() if gender_match else "Male"
    # Blood Type:
    bt_match = re.search(r'blood\s+type[:\s]+([abodeo+-]+)', text_lower)
    results['blood_type'] = bt_match.group(1).upper() if bt_match else "B+"
    # Name:
    name_match = re.search(r'patient\s+name[:\s]+([^\n]+)', text_lower)
    results['name'] = name_match.group(1).strip() if name_match else "Demo User"
    # Blood pressure:
    bp_match = re.search(r'blood\s+pressure[:\s]+(\d+/\d+)', text_lower)
    results['blood_pressure'] = bp_match.group(1) if bp_match else "120/80"

    return results

@app.route('/upload', methods=['POST'])
def upload_report():
    global vector_index
    file = request.files.get('report')
    
    if file:
        pdf = fitz.open(stream=file.read(), filetype="pdf")
        full_text = ""
        for page in pdf:
            full_text += page.get_text()
    else:
        # Fallback to checking json body or use default diabetic sample
        if request.is_json:
            data = request.get_json()
            sample_type = data.get('sample', 'diabetic') if data else 'diabetic'
        else:
            sample_type = request.form.get('sample', 'diabetic')
        full_text = SAMPLE_REPORTS.get(sample_type, SAMPLE_REPORTS['diabetic'])

    if LLAMA_AVAILABLE:
        try:
            documents = [Document(text=full_text)]
            embed_model = HuggingFaceEmbedding(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            vector_index = VectorStoreIndex.from_documents(
                documents, embed_model=embed_model
            )
        except Exception as e:
            print(f"RAG build failed: {e}")

    health_values = extract_health_values(full_text)
    
    # If using sample profiles, let's overwrite health_values to exactly match sample profiles' details
    # to be consistent with the fallback PATIENT_PROFILES in JS:
    sample_type = None
    if not file:
        if request.is_json:
            sample_type = request.get_json().get('sample')
        else:
            sample_type = request.form.get('sample')
    
    if sample_type in ['diabetic', 'cardiac', 'healthy']:
        # Align perfectly with front-end expectations
        if sample_type == 'diabetic':
            health_values.update({
                'name': "Demo User", 'age': 45, 'gender': "Male", 'blood_type': "B+",
                'blood_sugar': 186, 'hba1c': 8.4, 'cholesterol': 210, 'hdl': 38, 'ldl': 145,
                'haemoglobin': 12.8, 'bmi': 29.4, 'vitamin_d': 18, 'blood_pressure': "138/88",
                'conditions': ["Type 2 Diabetes", "Pre-hypertension", "Vitamin D Deficiency"],
                'risks': { 'diabetes': 88, 'cardiovascular': 62, 'obesity': 55, 'nutritional': 70 },
                'daily_calories': 1800, 'sample_type': "diabetic"
            })
        elif sample_type == 'cardiac':
            health_values.update({
                'name': "Demo User", 'age': 52, 'gender': "Female", 'blood_type': "O+",
                'blood_sugar': 98, 'hba1c': 5.6, 'cholesterol': 278, 'hdl': 32, 'ldl': 198,
                'haemoglobin': 11.2, 'bmi': 32.1, 'vitamin_d': 22, 'blood_pressure': "145/92",
                'conditions': ["High Cholesterol", "Obesity", "Mild Anaemia"],
                'risks': { 'diabetes': 35, 'cardiovascular': 85, 'obesity': 80, 'nutritional': 55 },
                'daily_calories': 1600, 'sample_type': "cardiac"
            })
        elif sample_type == 'healthy':
            health_values.update({
                'name': "Demo User", 'age': 28, 'gender': "Female", 'blood_type': "A+",
                'blood_sugar': 88, 'hba1c': 5.1, 'cholesterol': 165, 'hdl': 58, 'ldl': 95,
                'haemoglobin': 13.5, 'bmi': 22.4, 'vitamin_d': 42, 'blood_pressure': "112/72",
                'conditions': [],
                'risks': { 'diabetes': 12, 'cardiovascular': 10, 'obesity': 8, 'nutritional': 15 },
                'daily_calories': 2000, 'sample_type': "healthy"
            })
            
    return jsonify({'status': 'success', 'health_values': health_values})

@app.route('/chat', methods=['POST'])
def chat():
    global vector_index
    data = request.get_json()
    question = data.get('question', '')
    rag_context = ""

    if vector_index:
        try:
            query_engine = vector_index.as_query_engine()
            rag_context = str(query_engine.query(question))
        except Exception as e:
            rag_context = "Medical report context unavailable."

    try:
        from groq import Groq
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set.")
            
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are MediGuardian AI, a friendly health assistant.
Answer questions based on the patient medical report context below.
Keep responses to 2-4 sentences. Be empathetic but direct.
Redirect unrelated questions back to health and food topics.

PATIENT REPORT CONTEXT:
{rag_context}"""
                },
                {"role": "user", "content": question}
            ]
        )
        answer = response.choices[0].message.content
    except Exception as e:
        answer = f"I'm having trouble connecting right now. Please try again. (Error: {str(e)})"

    return jsonify({'answer': answer})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'running'})

if __name__ == '__main__':
    app.run(debug=False, port=5000)
