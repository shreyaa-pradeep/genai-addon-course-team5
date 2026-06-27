# 🩺 MediGuardian AI

> **Health. Food. Protected.**

MediGuardian AI is a full-stack, agentic AI web application that combines **Artificial Intelligence**, **Retrieval-Augmented Generation (RAG)**, and **health-aware food ordering**. Users can upload their medical reports, receive AI-powered health analysis, personalized nutrition recommendations, and safely order food based on their medical condition.

---

## 🌟 Features

- 📄 Upload PDF medical reports
- 🤖 RAG-powered medical report analysis
- 🧬 AI-driven health metric extraction
- ⚠️ Personalized health risk assessment
- 🥗 Smart nutrition recommendations
- 🍽️ AI-based health-safe food ordering
- 💬 Medical report chatbot using RAG
- 🔒 Privacy-first local report processing

---

# 🏗️ System Architecture

```text
                  Medical Report (PDF)
                           │
                           ▼
                PyMuPDF Text Extraction
                           │
                           ▼
             Biomedical Entity Recognition
                           │
                           ▼
          HuggingFace Embedding Generation
                           │
                           ▼
             LlamaIndex + ChromaDB (RAG)
                           │
          ┌────────────────┴───────────────┐
          │                                │
          ▼                                ▼
     Retrieval Engine              AI Chat Assistant
          │
          ▼
     Multi-Agent Analysis
          │
 ┌────────┼────────┬────────┬─────────┐
 ▼        ▼        ▼        ▼
Health   Risk   Nutrition  Food Safety
Agent    Agent     Agent      Agent
          │
          ▼
 Personalized Food Recommendations
```

---

# 🚀 Tech Stack

## Frontend

- HTML5
- CSS3
- JavaScript
- Google Fonts (Playfair Display & Inter)

## Backend

- Python
- Flask
- Flask-CORS

## AI & Machine Learning

- Retrieval-Augmented Generation (RAG)
- LlamaIndex
- HuggingFace Transformers
- Biomedical NER Model

## Database

- ChromaDB (Vector Database)

## PDF Processing

- PyMuPDF (fitz)

## Data Extraction

- Regular Expressions (Regex)

---

# 🤖 AI Agents

## 🧬 Health Analysis Agent

Extracts and analyzes:

- Blood Sugar
- HbA1c
- Cholesterol
- HDL
- LDL
- BMI
- Haemoglobin
- Vitamin D

---

## ⚠️ Risk Assessment Agent

Calculates:

- Diabetes Risk
- Cardiovascular Risk
- Obesity Risk
- Nutritional Deficiency Risk

---

## 🥗 Nutrition Agent

Generates:

- Foods to Include
- Foods to Avoid
- Daily Calorie Target
- Personalized Diet Plan

---

## 🍽️ Food Safety Agent

Evaluates every food order against the patient's medical profile and warns users about foods that may worsen existing health conditions.

---

## 💬 AI Chat Agent

Answers user questions using **Retrieval-Augmented Generation (RAG)** by retrieving information directly from the uploaded medical report.

---
