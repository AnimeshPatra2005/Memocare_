# MemoCare 🧠

**Creators**: Animesh Patra and Soham Ganguly

### Links
- **Live Demo**: [MemoCare on Hugging Face](https://samotar007-memocare.hf.space)
- **GitHub Repository**: [AnimeshPatra2005/Memocare_](https://github.com/AnimeshPatra2005/Memocare_)
## Overview
MemoCare is an intuitive, secure, and modern platform designed to aid in the detection and classification of Alzheimer's disease using deep learning models. The site enables users to upload MRI scan images for analysis and provides reliable classification into categories such as:
- Non-Demented
- Very Mild Demented
- Mild Demented
- Moderate Demented

Additionally, the platform allows users to input clinical medical data for classification, helping to determine whether a patient is likely to have Alzheimer's. This dual approach provides a comprehensive tool for early detection and monitoring of Alzheimer's disease progression.

### Core Upgrades (v2.0)
This project has been massively re-architected from a legacy Flask monolith into a modern, enterprise-grade application:
- **Microservice Architecture**: The backend is powered by 5 distinct FastAPI microservices running asynchronously on isolated internal ports to drastically reduce concurrent API latency.
- **End-to-End Encryption (E2EE)**: All sensitive patient medical history is encrypted client-side in the browser using WebCrypto AES-GCM before being stored in the database, ensuring zero-knowledge HIPAA-compliant data security.
- **Serverless Docker Deployment**: The entire stack (React frontend + 5 Python microservices) is packaged into a single multi-stage Docker container deployed on Hugging Face Spaces.

## Features
- **MRI Scan Analysis**: Utilizes a DenseNet201 feature extractor paired with an ANN classifier for accurate staging of dementia.
- **Clinical Data Assessment**: Utilizes an ensemble learning technique (Random Forest + Gradient Boosting + Logistic Regression meta-learner) to screen for Alzheimer's likelihood based on 17 clinical variables.
- **Zero-Knowledge Storage**: Users authenticate securely via Supabase (JWT), and encryption keys are derived locally in the browser to encrypt all medical records natively.
- **Automated PDF Reporting**: Asynchronous microservices compile and serve structured clinical PDF reports based on diagnostic metrics.
- **Interactive UI**: A stunning dark-themed interface built with React, Tailwind CSS, and 3D web graphics (`@react-three/fiber`).

## Dataset
This project utilizes two distinct models, each with its own dataset:

### Model-1: Medical Data Model
Model-1 uses a comprehensive medical dataset containing health information for 2,149 patients. The dataset includes demographic details, lifestyle factors, medical history, clinical measurements, cognitive and functional assessments, symptoms, and Alzheimer's diagnosis.
- **Dataset Link**: [Medical Data Dataset on Kaggle](https://www.kaggle.com/datasets/rabieelkharoua/alzheimers-disease-dataset/data)

### Model-2: MRI Scan Image Model
Model-2 uses a dataset of MRI scan images consisting of 6,400 images divided into four categories (augmented to 12,072 images to prevent overfitting).
- **Dataset Link**: [MRI Scan Dataset on Kaggle](https://www.kaggle.com/datasets/raihannaufalramadhan/alzheimer-data)

## Accuracy, Precision and Recall

#### Alzheimer Prediction Model (Tabular)
**Accuracy**: `95.81%`

**Label Legend**:  
- `0` → Negative for Alzheimer’s  
- `1` → Positive for Alzheimer’s

| Class | Precision | Recall | F1-Score | Support |
|-------|-----------|--------|----------|---------|
| 0 (No Alzheimer’s) | 0.96 | 0.98 | 0.97 | 277 |
| 1 (Positive Alzheimer’s) | 0.96 | 0.92 | 0.94 | 153 |

**Overall Accuracy**: `0.96`  
**Macro Average**: `Precision: 0.96`, `Recall: 0.95`, `F1-Score: 0.95`  
**Weighted Average**: `Precision: 0.96`, `Recall: 0.96`, `F1-Score: 0.96`

#### Dementia Detection Model (MRI)
**Test Accuracy**: `93.24%`

| Class Label | Description        | Precision | Recall | F1-Score | Support |
| ----------- | ------------------ | --------- | ------ | -------- | ------- |
| 0           | Non-Demented       | 0.97      | 0.93   | 0.95     | 717     |
| 1           | Very Mild Demented | 0.84      | 1.00   | 0.91     | 52      |
| 2           | Mild Demented      | 0.99      | 0.90   | 0.94     | 2560    |
| 3           | Moderate Demented  | 0.86      | 0.98   | 0.91     | 1792    |

**Macro Avg:** Precision: 0.91, Recall: 0.95, F1-Score: 0.93  
**Weighted Avg:** Precision: 0.94, Recall: 0.93, F1-Score: 0.93

## Technologies Used
- **Frontend**: React, Vite, Tailwind CSS, Three.js (React Three Fiber)
- **Backend**: FastAPI (Python), Uvicorn (Microservices)
- **Database**: Supabase (PostgreSQL), JWT Authentication
- **Security**: WebCrypto API (AES-GCM 256-bit encryption)
- **Machine Learning**: TensorFlow, Keras, Scikit-learn, Pandas
- **Deployment**: Docker, Hugging Face Spaces (Git LFS)

## Local Development (Docker)
Because the application is orchestrated as an all-in-one container, running it locally is incredibly simple:

```bash
# 1. Clone the repository
git clone https://github.com/AnimeshPatra2005/Memocare_.git
cd Memocare_

# 2. Build the Docker container (Compiles React + Installs Python packages)
docker build -t memocare .

# 3. Run the container on port 7860
docker run -p 7860:7860 -it memocare
```
Navigate to `http://localhost:7860` in your browser.

## Contact
For inquiries, please contact:
- [btech10357.23@bitmesra.ac.in](mailto:btech10357.23@bitmesra.ac.in)
- [btech10336.23@bitmesra.ac.in](mailto:btech10336.23@bitmesra.ac.in)

**Copyright Notice**  
All rights are reserved by the authors. Unauthorized use or distribution of this code is prohibited.
