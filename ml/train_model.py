import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
import joblib
import os

def generate_synthetic_data(samples=1000):
    """
    Generates a synthetic health dataset for risk prediction.
    Features: Age, Gender, SystolicBP, DiastolicBP, BloodSugar, BMI, HeartRate, Smoking, Exercise
    Target: Risk Level (0: Low, 1: Moderate, 2: High)
    """
    np.random.seed(42)

    # Features
    age = np.random.randint(18, 85, samples)
    gender = np.random.randint(0, 2, samples) # 0: Male, 1: Female
    systolic_bp = np.random.randint(90, 180, samples)
    diastolic_bp = np.random.randint(60, 110, samples)
    blood_sugar = np.random.randint(70, 200, samples)
    bmi = np.random.uniform(18.5, 40.0, samples)
    heart_rate = np.random.randint(50, 110, samples)
    smoking = np.random.randint(0, 2, samples) # 0: No, 1: Yes
    exercise = np.random.randint(0, 2, samples) # 0: No, 1: Yes

    data = pd.DataFrame({
        'age': age,
        'gender': gender,
        'systolic_bp': systolic_bp,
        'diastolic_bp': diastolic_bp,
        'blood_sugar': blood_sugar,
        'bmi': bmi,
        'heart_rate': heart_rate,
        'smoking': smoking,
        'exercise': exercise
    })

    # Target Generation Logic (Synthetic)
    # Calculate a risk score based on health parameters
    risk_score = (
        (data['age'] / 85) * 1.0 +
        (data['systolic_bp'] / 180) * 2.0 +
        (data['blood_sugar'] / 200) * 2.0 +
        (data['bmi'] / 40) * 1.5 +
        (data['smoking'] * 1.5) -
        (data['exercise'] * 1.0)
    )

    # Map score to risk levels
    def map_risk(score):
        if score < 3.5: return 0 # Low
        if score < 5.5: return 1 # Moderate
        return 2 # High

    data['risk_level'] = risk_score.apply(map_risk)
    return data

def train_and_save_model():
    print("Generating synthetic health data...")
    df = generate_synthetic_data()

    X = df.drop('risk_level', axis=1)
    y = df['risk_level']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Preprocessing data...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    print("Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train_scaled, y_train)

    # Evaluation
    y_pred = model.predict(X_test_scaled)
    print("\n--- Model Evaluation ---")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"Precision: {precision_score(y_test, y_pred, average='weighted'):.4f}")
    print(f"Recall: {recall_score(y_test, y_pred, average='weighted'):.4f}")
    print(f"F1 Score: {f1_score(y_test, y_pred, average='weighted'):.4f}")
    print("\nClassification Report:\n", classification_report(y_test, y_pred))

    # Save artifacts
    os.makedirs('ml', exist_ok=True)
    joblib.dump(model, 'ml/model.joblib')
    joblib.dump(scaler, 'ml/scaler.joblib')
    print("\nModel and Scaler saved to 'ml/model.joblib' and 'ml/scaler.joblib'")

if __name__ == "__main__":
    train_and_save_model()
