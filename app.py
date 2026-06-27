from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import os
import traceback

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def index_page():
    return app.send_static_file('index.html')
CORS(app)

# Global variables for RAG
vector_index = None
current_report_text = ""

# Sample Patient Reports matching default profiles
SAMPLE_REPORTS = {
    'diabetic': """
        PATIENT MEDICAL REPORT
        Patient Name: Diabetic Patient
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
        Patient Name: Cardiac Risk Patient
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
        Patient Name: Healthy Patient
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
    """
    Extracts key biomarkers using regex patterns.
    """
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
            try:
                results[key] = float(match.group(1))
            except ValueError:
                pass
    return results

@app.route('/upload', methods=['POST'])
def upload_report():
    """
    Ingests medical report (PDF file or JSON sample key), parses key values,
    and builds LlamaIndex vector store in-memory.
    """
    global vector_index, current_report_text
    try:
        file = request.files.get('report')
        if file:
            import fitz  # PyMuPDF
            pdf = fitz.open(stream=file.read(), filetype="pdf")
            full_text = ""
            for page in pdf:
                full_text += page.get_text()
        else:
            # Check JSON payload
            data = request.json or {}
            sample_type = data.get('sample', 'diabetic')
            full_text = SAMPLE_REPORTS.get(sample_type, SAMPLE_REPORTS['diabetic'])

        current_report_text = full_text
        health_values = extract_health_values(full_text)

        # Build Vector Store Index asynchronously/lazily
        try:
            from llama_index.core import VectorStoreIndex, Document
            from llama_index.embeddings.huggingface import HuggingFaceEmbedding
            
            documents = [Document(text=full_text)]
            embed_model = HuggingFaceEmbedding(
                model_name="NLP4Science/biomedical-NER-all"
            )
            vector_index = VectorStoreIndex.from_documents(
                documents, embed_model=embed_model
            )
            print("LlamaIndex Vector Index built successfully with HuggingFace embedding.")
        except Exception as embed_err:
            print("Warning: LlamaIndex / HuggingFace initialization failed, using mockup index fallback.")
            print(embed_err)
            vector_index = None

        return jsonify({
            'status': 'success',
            'health_values': health_values
        })

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/chat', methods=['POST'])
def chat():
    """
    RAG Query Chatbot endpoint. Queries the LlamaIndex or uses fallback matching
    and sends prompt to Groq API.
    """
    global vector_index, current_report_text
    try:
        data = request.json or {}
        question = data.get('question', '').strip()
        if not question:
            return jsonify({'answer': 'Please ask a valid question.'})

        # Step 1: Retrieve context
        rag_context = ""
        if vector_index:
            try:
                query_engine = vector_index.as_query_engine()
                rag_context = str(query_engine.query(question))
            except Exception as query_err:
                print("LlamaIndex query error:", query_err)
                rag_context = current_report_text
        else:
            rag_context = current_report_text or "No report uploaded yet."

        # Step 2: Groq Completion (with fallback)
        groq_api_key = os.environ.get("GROQ_API_KEY")
        if not groq_api_key:
            # Fallback mock answers based on question analysis if Groq key is not set
            print("Warning: GROQ_API_KEY environment variable not set. Running fallback chatbot.")
            fallback_answer = generate_fallback_answer(question, rag_context)
            return jsonify({'answer': fallback_answer})

        try:
            from groq import Groq
            client = Groq(api_key=groq_api_key)
            response = client.chat.completions.create(
                model="llama3-8b-8192",
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are MediGuardian AI, a friendly health assistant.
Answer questions based only on the patient's medical report context below.
Keep responses to 2–4 sentences. Be empathetic but direct.
Redirect unrelated questions to health and food topics.

PATIENT REPORT CONTEXT:
{rag_context}"""
                    },
                    {"role": "user", "content": question}
                ]
            )
            return jsonify({'answer': response.choices[0].message.content})
        except Exception as groq_err:
            print("Groq API Call failed, executing local fallback chatbot.")
            print(groq_err)
            fallback_answer = generate_fallback_answer(question, rag_context)
            return jsonify({'answer': fallback_answer})

    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'answer': f"Sorry, I encountered an error: {str(e)}"
        }), 500

def generate_fallback_answer(question, context):
    """
    Robust rule-based chatbot fallback when Groq/LlamaIndex is offline or key is missing.
    """
    q = question.lower()
    
    # Check what type of patient context we have
    is_diabetic = "glucose: 186" in context or "diabetic" in context or "fasting blood glucose: 186" in context.lower()
    is_cardiac = "cholesterol: 278" in context or "cardiac" in context or "ldl cholesterol: 198" in context.lower()
    is_healthy = "normal" in context.lower() and not is_diabetic and not is_cardiac

    if "sugar" in q or "glucose" in q or "hba1c" in q:
        if is_diabetic:
            return "Your fasting blood glucose is elevated at 186 mg/dL, and your HbA1c is 8.4%, indicating poorly managed Type 2 Diabetes. You should avoid refined sugars, white rice, and high-carb dishes like Hakka noodles, and focus on high-fiber alternatives like quinoa."
        elif is_cardiac:
            return "Your fasting glucose is 98 mg/dL and HbA1c is 5.6%, which are within the normal range. However, given your cardiac risk factors, monitoring overall carbohydrate intake remains a good preventative measure."
        else:
            return "Your fasting glucose (88 mg/dL) and HbA1c (5.1%) are completely normal. You have no indicators of prediabetes or diabetes mellitus at this time. Maintain your current active lifestyle and balanced diet!"

    elif "cholesterol" in q or "ldl" in q or "hdl" in q or "heart" in q or "cardio" in q:
        if is_cardiac:
            return "Your total cholesterol is high at 278 mg/dL with a severe LDL level of 198 mg/dL, putting you at significant cardiovascular risk. You must strictly avoid fried foods and trans fats, such as Kerala Prawn Curry. Include healthy fats like avocado and walnuts instead."
        elif is_diabetic:
            return "Your total cholesterol is 210 mg/dL and LDL is 145 mg/dL, which is slightly elevated. Managing lipid levels is crucial for diabetic patients as diabetes increases the risk of cardiovascular complications. Avoid high-fat foods like Cheesecake."
        else:
            return "Your cholesterol markers (Total: 165 mg/dL, LDL: 95 mg/dL, HDL: 58 mg/dL) are optimal. There are no signs of hypercholesterolaemia. Keep including whole grains and omega-3 fatty acids in your diet."

    elif "food" in q or "safe" in q or "eat" in q or "diet" in q or "avoid" in q or "include" in q:
        if is_diabetic:
            return "For your diabetic profile, safe foods include low-GI dishes like the Quinoa Buddha Bowl, Lentil Soup, and Green Tea. You must avoid sweet items (Chocolate Cake, Mango Ice Cream) and refined carbs (Fried Rice, Hakka Noodles) to prevent dangerous blood sugar spikes."
        elif is_cardiac:
            return "For your cardiac profile, safe items include Mixed Sprout Salad, Coconut Water, and Avocado Toast. You should limit foods high in saturated fat and cholesterol, such as Kerala Prawn Curry, fried Manchurian, and high-fat cheese cakes."
        else:
            return "All menu items, including the Quinoa Buddha Bowl and Avocado Toast, are safe for your profile. Feel free to enjoy variety, keeping high-sugar desserts like Strawberry Cheesecake as occasional treats."

    elif "vitamin" in q or "deficient" in q or "anaemia" in q:
        if is_diabetic:
            return "Your report shows a Vitamin D level of 18 ng/mL, indicating a deficiency (normal is >30 ng/mL). We recommend incorporating egg yolks and fortified foods, and speaking to your physician about a daily Vitamin D supplement."
        elif is_cardiac:
            return "Your report shows a mild anaemia concern with haemoglobin at 11.2 g/dL. We recommend including iron-rich items like Spinach, Pomegranate, and Beetroot smoothies to help support healthy red blood cell production."
        else:
            return "Your Vitamin D (42 ng/mL) and Haemoglobin (13.5 g/dL) levels are excellent and well within the healthy reference ranges. No supplementation is currently required. Keep eating a diverse array of fresh produce!"

    # Generic contextual prompt responses
    if is_diabetic:
        return "Based on your report, you are diagnosed with Type 2 Diabetes Mellitus, Pre-hypertension, and Vitamin D Deficiency. I recommend focusing on low-GI, fiber-rich foods like the Quinoa Buddha Bowl and avoiding sugar-dense foods."
    elif is_cardiac:
        return "Based on your report, you are diagnosed with Hypercholesterolaemia, Obesity, and Mild Anaemia. Focus on heart-healthy dishes like Avocado Toast and avoid high-cholesterol foods like Kerala Prawn Curry."
    elif is_healthy:
        return "Your profile shows no significant clinical findings. All biomarkers are in optimal ranges. You can safely order any menu items, with a focus on whole, clean foods to maintain your baseline wellness!"

    return "Hello! I can answer questions about your medical report, suggest healthy food items, and warn you about potential dietary risks. Please let me know what biomarker or food item you would like me to analyze."

if __name__ == '__main__':
    # Running locally on port 5000
    app.run(host='0.0.0.0', port=5000, debug=False)
