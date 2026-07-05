from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from fpdf import FPDF
import datetime

app = FastAPI(title="MemoCare PDF Report Service", version="1.0.0")

class ReportRequest(BaseModel):
    patient_name: str
    patient_id: str
    alzheimers_probability: float  # e.g., 0.85 for 85%
    clinical_scores: dict

class MemoCarePDF(FPDF):
    def header(self):
        self.set_font('helvetica', 'B', 20)
        self.cell(0, 10, 'MemoCare Clinical Assessment Report', border=0, new_x="LMARGIN", new_y="NEXT", align='C')
        self.set_font('helvetica', 'I', 10)
        self.cell(0, 10, 'Confidential AI-Assisted Screening', border=0, new_x="LMARGIN", new_y="NEXT", align='C')
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('helvetica', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='C')

@app.post("/generate")
async def generate_report(data: ReportRequest):
    try:
        pdf = MemoCarePDF()
        pdf.add_page()
        
        # 1. Patient Details Section
        pdf.set_font('helvetica', 'B', 14)
        pdf.set_fill_color(200, 220, 255) # Light Blue
        pdf.cell(0, 10, ' Patient Information', border=0, new_x="LMARGIN", new_y="NEXT", align='L', fill=True)
        
        pdf.set_font('helvetica', '', 12)
        pdf.ln(5)
        pdf.cell(100, 8, f"Patient Name: {data.patient_name}")
        pdf.cell(90, 8, f"Patient ID: {data.patient_id}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(100, 8, f"Date of Assessment: {datetime.date.today().strftime('%B %d, %Y')}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(10)
        
        # 2. AI Verdict Section
        pdf.set_font('helvetica', 'B', 14)
        pdf.set_fill_color(220, 220, 220) # Light Gray
        pdf.cell(0, 10, ' Assessment Result (AI Ensemble Model)', border=0, new_x="LMARGIN", new_y="NEXT", align='L', fill=True)
        pdf.ln(5)
        
        prob_percent = data.alzheimers_probability * 100
        
        # Determine styling based on risk
        if prob_percent >= 75:
            risk_level = "HIGH LIKELIHOOD"
            pdf.set_text_color(200, 0, 0) # Red
        elif prob_percent >= 40:
            risk_level = "MODERATE LIKELIHOOD"
            pdf.set_text_color(200, 150, 0) # Orange
        else:
            risk_level = "LOW LIKELIHOOD"
            pdf.set_text_color(0, 150, 0) # Green
            
        pdf.set_font('helvetica', 'B', 16)
        pdf.cell(0, 10, f"Risk Probability: {prob_percent:.1f}% - {risk_level}", border=0, new_x="LMARGIN", new_y="NEXT", align='L')
        pdf.set_text_color(0, 0, 0) # Reset color to black
        
        pdf.set_font('helvetica', '', 11)
        pdf.multi_cell(0, 8, "Based on the provided clinical metrics and lifestyle factors, the MemoCare AI model has calculated the above probability for cognitive decline / Alzheimer's Disease. This is a screening tool and does not constitute a formal medical diagnosis.")
        pdf.ln(10)
        
        # 3. Clinical Scores Table
        pdf.set_font('helvetica', 'B', 14)
        pdf.set_fill_color(200, 220, 255)
        pdf.cell(0, 10, ' Clinical Metrics & Inputs provided', border=0, new_x="LMARGIN", new_y="NEXT", align='L', fill=True)
        pdf.ln(5)
        
        pdf.set_font('helvetica', 'B', 12)
        pdf.cell(95, 10, 'Metric', border=1, align='C')
        pdf.cell(95, 10, 'Value', border=1, new_x="LMARGIN", new_y="NEXT", align='C')
        
        pdf.set_font('helvetica', '', 12)
        
        # Mapping to add proper spacing and medical units to the raw keys
        metric_labels = {
            "FunctionalAssessment": "Functional Assessment (FAST)",
            "ADL": "Activities of Daily Living (ADL)",
            "MMSE": "MMSE Score (/30)",
            "MemoryComplaints": "Memory Complaints",
            "BehavioralProblems": "Behavioral Problems",
            "PhysicalActivity": "Physical Activity Level",
            "SleepQuality": "Sleep Quality",
            "DietQuality": "Diet Quality",
            "CholesterolTotal": "Total Cholesterol (mg/dL)",
            "CholesterolLDL": "LDL Cholesterol (mg/dL)",
            "CholesterolHDL": "HDL Cholesterol (mg/dL)",
            "CholesterolTriglycerides": "Triglycerides (mg/dL)",
            "SystolicBP": "Systolic Blood Pressure (mmHg)",
            "DiastolicBP": "Diastolic Blood Pressure (mmHg)",
            "BMI": "Body Mass Index (kg/m^2)",
            "AlcoholConsumption": "Alcohol Consumption",
            "Age": "Age (years)"
        }
        
        for key, value in data.clinical_scores.items():
            # Use the nicely formatted label, or fallback to the raw key
            formatted_key = metric_labels.get(key, str(key))
            
            # Format 0/1 as No/Yes for boolean inputs to look more professional
            if key in ["MemoryComplaints", "BehavioralProblems"]:
                formatted_value = "Yes" if float(value) == 1.0 else "No"
            else:
                formatted_value = str(value)

            pdf.cell(95, 10, formatted_key, border=1, align='L')
            pdf.cell(95, 10, formatted_value, border=1, new_x="LMARGIN", new_y="NEXT", align='C')
            
        # 4. Generate PDF output directly to bytes
        pdf_bytes = bytes(pdf.output())
        
        # 5. Tell the browser to download it as a .pdf file
        headers = {
            "Content-Disposition": "attachment; filename=memocare_report.pdf"
        }
        
        # Return the raw PDF bytes directly to the browser
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
