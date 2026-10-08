from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import base64
import asyncio
import hashlib
import hmac
from io import BytesIO
import json
import joblib
import numpy as np
from datetime import datetime, timedelta
from email.message import EmailMessage
import logging
import re
import secrets
import smtplib
import ssl
from typing import Any, List, Literal, Optional
from backend.database import user_collection, health_logs_collection, save_health_log, get_health_history
from groq import Groq
import os
from dotenv import load_dotenv
from pypdf import PdfReader
from ml.skin_screening import InvalidSkinImage, SkinModelNotConfigured, screen_skin_image
from ml.fracture_screening import (
    FractureModelNotConfigured,
    InvalidXrayImage,
    screen_bone_xray,
)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize Groq Client
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("Warning: GROQ_API_KEY not found in environment variables.")
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
EMAIL_TOKEN_TTL_HOURS = 24
PASSWORD_RESET_TOKEN_TTL_MINUTES = 30
EMAIL_VERIFICATION_CODE_TTL_MINUTES = 10
EMAIL_VERIFICATION_RESEND_WAIT_SECONDS = 60
EMAIL_VERIFICATION_MAX_ATTEMPTS = 5
MAX_REPORT_BYTES = 10 * 1024 * 1024
MAX_SKIN_IMAGE_BYTES = 10 * 1024 * 1024
MAX_XRAY_IMAGE_BYTES = 10 * 1024 * 1024
MAX_PDF_PAGES = 20
MAX_PDF_TEXT_LENGTH = 30000

app = FastAPI(title="Smart Health Management API")

# CORS configuration for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML models
try:
    model = joblib.load('ml/model.joblib')
    scaler = joblib.load('ml/scaler.joblib')
except Exception as e:
    print(f"Error loading ML models: {e}")
    model = None
    scaler = None

# Data Models
class HealthData(BaseModel):
    age: int = Field(..., ge=18, le=120)
    gender: int = Field(..., ge=0, le=1) # 0: Male, 1: Female
    systolic_bp: int = Field(..., ge=70, le=250)
    diastolic_bp: int = Field(..., ge=40, le=150)
    blood_sugar: int = Field(..., ge=40, le=500)
    bmi: float = Field(..., ge=10.0, le=60.0)
    heart_rate: int = Field(..., ge=30, le=220)
    smoking: int = Field(..., ge=0, le=1)
    exercise: int = Field(..., ge=0, le=1)

class ProfileUpdateRequest(BaseModel):
    user_id: str
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=18, le=120)
    gender: int = Field(..., ge=0, le=1)
    height_cm: Optional[float] = Field(None, ge=50, le=260)
    weight_kg: Optional[float] = Field(None, ge=20, le=500)
    blood_group: Optional[str] = Field(None, pattern=r"^(A|B|AB|O)[+-]$")
    avatar_id: Optional[Literal["avatar_1", "avatar_2", "avatar_3", "avatar_4", "avatar_5", "avatar_6"]] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=2000)

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., min_length=1, max_length=20)

class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=18, le=120)
    gender: int = Field(..., ge=0, le=1)
    height_cm: Optional[float] = Field(None, ge=50, le=260)
    weight_kg: Optional[float] = Field(None, ge=20, le=500)
    blood_group: Optional[str] = Field(None, pattern=r"^(A|B|AB|O)[+-]$")

class EmailTokenRequest(BaseModel):
    token: str = Field(..., min_length=20, max_length=200)

class EmailCodeVerificationRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    code: str = Field(..., pattern=r"^\d{6}$")

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=254)

class ResendVerificationRequest(BaseModel):
    username_or_email: str = Field(..., min_length=1, max_length=254)

class ResetPasswordRequest(EmailTokenRequest):
    password: str = Field(..., min_length=8, max_length=128)

class PredictionResponse(BaseModel):
    risk_level: str
    risk_score: int
    explanation: str
    recommendations: List[str]
    timestamp: str

# Mapping for Risk Levels
RISK_MAP = {0: "Low Risk", 1: "Moderate Risk", 2: "High Risk"}

# Mapping for risk explanations
RISK_EXPLANATIONS = {
    0: "Your vitals are within the healthy range. Maintaining this lifestyle will help keep your risk low.",
    1: "Some of your vitals are slightly elevated. We recommend monitoring your blood pressure and diet.",
    2: "Several key health markers are in the high-risk zone. We strongly advise consulting a healthcare professional."
}

def get_recommendations(risk_level):
    recs = {
        0: ["Maintain your current healthy lifestyle.", "Continue regular check-ups.", "Keep staying active!"],
        1: ["Consider increasing daily physical activity.", "Monitor your blood pressure more frequently.", "Reduce sugar intake and processed foods."],
        2: ["Schedule an appointment with a healthcare professional immediately.", "Strictly monitor blood pressure and blood sugar.", "Adopt a heart-healthy diet and lifestyle changes."]
    }
    return recs.get(risk_level, [])

def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    iterations = 600_000
    password_hash = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${password_hash.hex()}"

def _password_matches(password: str, stored_password: str) -> bool:
    if stored_password.startswith("pbkdf2_sha256$"):
        try:
            _, iteration_text, salt_hex, hash_hex = stored_password.split("$", maxsplit=3)
            iterations = int(iteration_text)
            if iterations < 1 or iterations > 2_000_000:
                return False
            salt = bytes.fromhex(salt_hex)
            expected_hash = bytes.fromhex(hash_hex)
            actual_hash = hashlib.pbkdf2_hmac(
                "sha256",
                password.encode("utf-8"),
                salt,
                iterations,
                dklen=len(expected_hash),
            )
            return hmac.compare_digest(actual_hash, expected_hash)
        except (ValueError, TypeError):
            return False
    return hmac.compare_digest(password, stored_password)

def _new_email_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return token, token_hash

def _email_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def _email_code_hash(email: str, code: str) -> str:
    return hmac.new(
        SMTP_PASSWORD.encode("utf-8"),
        f"{email.lower()}:{code}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

def _send_verification_code(account: dict[str, Any], code: str) -> None:
    _send_email(
        account["email"],
        "Your Smart Health verification code",
        f"Hello {account.get('name', '')},\n\nYour Smart Health email verification code is: {code}\n\nEnter this code in the registration screen. It expires in {EMAIL_VERIFICATION_CODE_TTL_MINUTES} minutes. If you did not create this account, you can ignore this message.",
    )

def _require_smtp_configuration() -> None:
    if not all((SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL)):
        raise HTTPException(
            status_code=503,
            detail="Email delivery is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL.",
        )

def _send_email(recipient: str, subject: str, body: str) -> None:
    _require_smtp_configuration()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = recipient
    message.set_content(body)

    context = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=15) as server:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)

def _is_token_expired(expiry: Optional[str]) -> bool:
    if not expiry:
        return True
    try:
        return datetime.fromisoformat(expiry) <= datetime.now()
    except ValueError:
        return True

@app.get("/")
async def root():
    return {"message": "Welcome to Smart Health Management API. Use /docs for API documentation."}

@app.post("/chat")
def chat(request: ChatRequest):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="The health assistant is unavailable because GROQ_API_KEY is not configured.",
        )

    try:
        completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful health education assistant. Give general information only; "
                        "do not diagnose, prescribe medication, or present uncertain information as fact. "
                        "Encourage users to consult a qualified healthcare professional for personal "
                        "medical advice, and to seek emergency care for severe or urgent symptoms."
                    ),
                },
                *[{"role": message.role, "content": message.content} for message in request.messages],
            ],
            model="openai/gpt-oss-120b",
        )
        reply = completion.choices[0].message.content
        if not reply or not reply.strip():
            raise HTTPException(status_code=502, detail="The health assistant returned an empty response.")
        return {"reply": reply.strip()}
    except HTTPException:
        raise
    except Exception as error:
        logger.exception("Health assistant request failed: %s", error)
        raise HTTPException(
            status_code=502,
            detail="The health assistant could not generate a response. Please try again.",
        ) from error

@app.post("/login")
async def login(request: LoginRequest):
    user = await user_collection.find_one({"username": request.username})
    if user and _password_matches(request.password, user.get("password", "")):
        if user.get("email_verified") is False:
            raise HTTPException(status_code=403, detail="Verify your email address before signing in.")
        if not user["password"].startswith("pbkdf2_sha256$"):
            await user_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"password": _hash_password(request.password)}},
            )
        return {
            "user_id": str(user["_id"]),
            "username": request.username,
            "name": user.get("name", request.username),
            "age": user.get("age"),
            "gender": user.get("gender"),
            "height_cm": user.get("height_cm"),
            "weight_kg": user.get("weight_kg"),
            "blood_group": user.get("blood_group"),
            "avatar_id": user.get("avatar_id"),
            "status": "success",
        }
    if request.username == "admin" and request.password == "admin":
        return {"user_id": "admin_123", "username": request.username, "name": "Administrator", "status": "success"}
    elif request.username == "user" and request.password == "password":
        return {"user_id": "user_456", "username": request.username, "name": "Health User", "status": "success"}
    raise HTTPException(status_code=401, detail="Invalid username or password")

@app.post("/register")
async def register(request: RegisterRequest):
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", request.email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if not request.username.strip() or not request.name.strip():
        raise HTTPException(status_code=422, detail="Name and username are required.")
    _require_smtp_configuration()
    username = request.username.strip()
    email = request.email.strip().lower()
    name = request.name.strip()
    existing_user = await user_collection.find_one({"username": username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    existing_email = await user_collection.find_one({"email": email})
    if existing_email:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    verification_code = f"{secrets.randbelow(1_000_000):06d}"
    user_doc = {
        "username": username,
        "email": email,
        "password": _hash_password(request.password),
        "name": name,
        "age": request.age,
        "gender": request.gender,
        "height_cm": request.height_cm,
        "weight_kg": request.weight_kg,
        "blood_group": request.blood_group,
        "avatar_id": "avatar_2" if request.gender == 0 else "avatar_1",
        "email_verified": False,
        "email_verification_code_hash": _email_code_hash(email, verification_code),
        "email_verification_code_expires_at": (
            datetime.now() + timedelta(minutes=EMAIL_VERIFICATION_CODE_TTL_MINUTES)
        ).isoformat(),
        "email_verification_attempts": 0,
        "email_verification_last_sent_at": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
    }
    result = await user_collection.insert_one(user_doc)
    try:
        await asyncio.to_thread(_send_verification_code, user_doc, verification_code)
    except Exception as error:
        await user_collection.delete_one({"_id": result.inserted_id})
        logger.exception("Could not send registration verification email: %s", error)
        raise HTTPException(status_code=502, detail="Could not send the verification email. Check the email settings and try again.") from error
    return {
        "user_id": str(result.inserted_id),
        "email": email,
        "status": "Account created. Enter the 6-digit verification code sent to your email.",
    }

@app.post("/verify-email-code")
async def verify_email_code(request: EmailCodeVerificationRequest):
    email = request.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    account = await user_collection.find_one({"email": email})
    if account is None or account.get("email_verified") is True:
        raise HTTPException(status_code=400, detail="This code is invalid or expired. Request a new code.")

    attempts = account.get("email_verification_attempts", 0)
    if attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS or _is_token_expired(
        account.get("email_verification_code_expires_at")
    ):
        raise HTTPException(status_code=400, detail="This code is invalid or expired. Request a new code.")

    supplied_hash = _email_code_hash(email, request.code)
    expected_hash = account.get("email_verification_code_hash", "")
    if not expected_hash or not hmac.compare_digest(supplied_hash, expected_hash):
        await user_collection.update_one(
            {"_id": account["_id"]},
            {"$set": {"email_verification_attempts": attempts + 1}},
        )
        remaining_attempts = max(EMAIL_VERIFICATION_MAX_ATTEMPTS - attempts - 1, 0)
        if remaining_attempts == 0:
            raise HTTPException(status_code=400, detail="Too many incorrect codes. Request a new code.")
        raise HTTPException(
            status_code=400,
            detail=f"That code is incorrect. You have {remaining_attempts} attempt(s) remaining.",
        )

    await user_collection.update_one(
        {"_id": account["_id"]},
        {"$set": {
            "email_verified": True,
            "email_verification_code_hash": None,
            "email_verification_code_expires_at": None,
            "email_verification_attempts": 0,
        }},
    )
    return {"status": "Email verified. You can now sign in."}

@app.post("/verify-email")
async def verify_email(request: EmailTokenRequest):
    account = await user_collection.find_one({"email_verification_token_hash": _email_token_hash(request.token)})
    if account is None or _is_token_expired(account.get("email_verification_expires_at")):
        raise HTTPException(status_code=400, detail="This verification link is invalid or expired. Register again or request a new link.")
    await user_collection.update_one(
        {"_id": account["_id"]},
        {"$set": {
            "email_verified": True,
            "email_verification_token_hash": None,
            "email_verification_expires_at": None,
        }},
    )
    return {"status": "Email verified. You can now sign in."}

@app.post("/resend-verification")
async def resend_verification(request: ResendVerificationRequest):
    _require_smtp_configuration()
    identifier = request.username_or_email.strip()
    account = await user_collection.find_one({"email": identifier.lower()})
    if account is None:
        account = await user_collection.find_one({"username": identifier})

    response = {"status": "If that account needs verification, a new verification email will be sent."}
    if account is None or account.get("email_verified") is True or not account.get("email"):
        return response

    last_sent_at = account.get("email_verification_last_sent_at")
    if last_sent_at:
        try:
            elapsed = (datetime.now() - datetime.fromisoformat(last_sent_at)).total_seconds()
        except ValueError:
            elapsed = EMAIL_VERIFICATION_RESEND_WAIT_SECONDS
        if elapsed < EMAIL_VERIFICATION_RESEND_WAIT_SECONDS:
            raise HTTPException(
                status_code=429,
                detail="Please wait a minute before requesting another verification code.",
            )

    code = f"{secrets.randbelow(1_000_000):06d}"
    await user_collection.update_one(
        {"_id": account["_id"]},
        {"$set": {
            "email_verification_code_hash": _email_code_hash(account["email"], code),
            "email_verification_code_expires_at": (
                datetime.now() + timedelta(minutes=EMAIL_VERIFICATION_CODE_TTL_MINUTES)
            ).isoformat(),
            "email_verification_attempts": 0,
            "email_verification_last_sent_at": datetime.now().isoformat(),
        }},
    )
    try:
        await asyncio.to_thread(_send_verification_code, account, code)
    except Exception as error:
        logger.exception("Could not send resent verification email: %s", error)
        await user_collection.update_one(
            {"_id": account["_id"]},
            {"$set": {
                "email_verification_code_hash": None,
                "email_verification_code_expires_at": None,
            }},
        )
        raise HTTPException(status_code=502, detail="Could not send the verification code. Please try again later.") from error
    return response

@app.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    _require_smtp_configuration()
    email = request.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return {"status": "If an account exists for that email, a password reset link will be sent."}

    account = await user_collection.find_one({"email": email, "email_verified": True})
    if account is not None:
        token, token_hash = _new_email_token()
        await user_collection.update_one(
            {"_id": account["_id"]},
            {"$set": {
                "password_reset_token_hash": token_hash,
                "password_reset_expires_at": (
                    datetime.now() + timedelta(minutes=PASSWORD_RESET_TOKEN_TTL_MINUTES)
                ).isoformat(),
            }},
        )
        reset_link = f"{FRONTEND_URL}/?reset_password={token}"
        try:
            await asyncio.to_thread(
                _send_email,
                email,
                "Reset your Smart Health password",
                f"Hello {account.get('name', '')},\n\nUse this one-time link to set a new password:\n{reset_link}\n\nThis link expires in {PASSWORD_RESET_TOKEN_TTL_MINUTES} minutes. If you did not request a password reset, you can ignore this message.",
            )
        except Exception as error:
            logger.exception("Could not send password reset email: %s", error)

    return {"status": "If an account exists for that email, a password reset link will be sent."}

@app.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    token_hash = _email_token_hash(request.token)
    account = await user_collection.find_one({"password_reset_token_hash": token_hash})
    if account is None or _is_token_expired(account.get("password_reset_expires_at")):
        raise HTTPException(status_code=400, detail="This password reset link is invalid or expired. Request a new one.")
    await user_collection.update_one(
        {"_id": account["_id"]},
        {"$set": {
            "password": _hash_password(request.password),
            "password_reset_token_hash": None,
            "password_reset_expires_at": None,
        }},
    )
    return {"status": "Password updated. You can now sign in."}

@app.post("/analyze-report")
async def analyze_report(file: UploadFile = File(...), user_id: str = Form(None)):
    if client is None:
        raise HTTPException(
            status_code=503,
            detail="Report analysis is unavailable because GROQ_API_KEY is not configured.",
        )

    filename = file.filename or "health-report"
    extension = os.path.splitext(filename)[1].lower()
    report_bytes = await file.read(MAX_REPORT_BYTES + 1)
    if len(report_bytes) > MAX_REPORT_BYTES:
        raise HTTPException(status_code=413, detail="The report is too large. Maximum file size is 10 MB.")
    if not report_bytes:
        raise HTTPException(status_code=400, detail="The selected report is empty.")

    if extension == ".pdf" and report_bytes.startswith(b"%PDF-"):
        try:
            reader = PdfReader(BytesIO(report_bytes), strict=False)
            if len(reader.pages) > MAX_PDF_PAGES:
                raise HTTPException(
                    status_code=413,
                    detail=f"The PDF has more than {MAX_PDF_PAGES} pages. Please upload a shorter report.",
                )
            report_content = "\n".join(page.extract_text() or "" for page in reader.pages)
        except HTTPException:
            raise
        except Exception as error:
            logger.exception("Could not read uploaded PDF %s: %s", filename, error)
            raise HTTPException(status_code=400, detail="This PDF could not be read. Please check the file and try again.") from error

        report_content = report_content.strip()
        if not report_content:
            raise HTTPException(
                status_code=422,
                detail="No readable text was found in this PDF. For scanned reports, upload a clear PNG or JPEG image instead.",
            )

        report_input: Any = report_content[:MAX_PDF_TEXT_LENGTH]
        file_type = "PDF Report"
    elif extension in {".png", ".jpg", ".jpeg"}:
        expected_signature = {
            ".png": report_bytes.startswith(b"\x89PNG\r\n\x1a\n"),
            ".jpg": report_bytes.startswith(b"\xff\xd8\xff"),
            ".jpeg": report_bytes.startswith(b"\xff\xd8\xff"),
        }
        if not expected_signature[extension]:
            raise HTTPException(status_code=400, detail="The file contents do not match a supported image format.")
        media_type = "image/png" if extension == ".png" else "image/jpeg"
        image_data = base64.b64encode(report_bytes).decode("ascii")
        report_input = [
            {"type": "text", "text": "Analyze the attached health report image."},
            {"type": "image_url", "image_url": {"url": f"data:{media_type};base64,{image_data}"}},
        ]
        file_type = "Medical Image"
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file format. Upload a text-based PDF, PNG, or JPEG image.",
        )

    prompt = (
        "Analyze the supplied health report content. Extract only measurements that are explicitly "
        "visible or stated in the report; do not infer missing values. Return a JSON object with "
        "these exact keys: detected_metrics (object with systolic_bp, diastolic_bp, blood_sugar, "
        "bmi, and heart_rate; values must be strings with units or null), summary (string), "
        "recommendations (array of three general next steps), confidence_score (string). "
        "If a value is absent or unreadable, use null. Do not diagnose or prescribe medication. "
        "Explain that this analysis is informational and not a medical diagnosis."
    )
    if isinstance(report_input, str):
        user_content: Any = f"{prompt}\n\nReport text:\n{report_input}"
    else:
        user_content = [{"type": "text", "text": prompt}, *report_input[1:]]

    try:
        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": "You analyze health reports carefully and return valid JSON only."},
                {"role": "user", "content": user_content},
            ],
            model="qwen/qwen3.8-27b",
            response_format={"type": "json_object"},
            max_completion_tokens=1200,
        )
        response_content = completion.choices[0].message.content
        if not response_content:
            raise ValueError("The model returned an empty response.")
        analysis = json.loads(response_content)
        if not isinstance(analysis.get("detected_metrics"), dict):
            raise ValueError("The model response did not include valid detected metrics.")
        if not isinstance(analysis.get("summary"), str) or not isinstance(analysis.get("recommendations"), list):
            raise ValueError("The model response did not include a valid summary and recommendations.")
    except Exception as error:
        logger.exception("Report analysis failed for %s: %s", filename, error)
        raise HTTPException(
            status_code=502,
            detail="The report could not be analyzed by the AI service. Please try again.",
        ) from error

    return {
        "file_name": filename,
        "file_type": file_type,
        "analyzed_at": datetime.now().isoformat(),
        **analysis,
    }

@app.post("/screen-skin-image")
async def screen_skin_image_endpoint(file: UploadFile = File(...)):
    image_bytes = await file.read(MAX_SKIN_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_SKIN_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="The image is too large. Maximum size is 10 MB.")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    try:
        return await asyncio.to_thread(screen_skin_image, image_bytes)
    except InvalidSkinImage as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except SkinModelNotConfigured as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

@app.post("/screen-bone-xray")
async def screen_bone_xray_endpoint(file: UploadFile = File(...)):
    image_bytes = await file.read(MAX_XRAY_IMAGE_BYTES + 1)
    if len(image_bytes) > MAX_XRAY_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="The image is too large. Maximum size is 10 MB.")
    if not image_bytes:
        raise HTTPException(status_code=400, detail="The uploaded image is empty.")

    try:
        return await asyncio.to_thread(screen_bone_xray, image_bytes)
    except InvalidXrayImage as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FractureModelNotConfigured as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

@app.post("/predict", response_model=PredictionResponse)
async def predict_risk(data: HealthData):
    if model is None or scaler is None:
        raise HTTPException(status_code=500, detail="ML models not loaded on server.")
    features = np.array([[
        data.age, data.gender, data.systolic_bp, data.diastolic_bp,
        data.blood_sugar, data.bmi, data.heart_rate, data.smoking, data.exercise
    ]])
    scaled_features = scaler.transform(features)
    prediction = model.predict(scaled_features)[0]
    risk_text = RISK_MAP[prediction]
    explanation = RISK_EXPLANATIONS.get(prediction, "No explanation available.")
    recommendations = get_recommendations(prediction)
    return {
        "risk_level": risk_text,
        "risk_score": int(prediction),
        "explanation": explanation,
        "recommendations": recommendations,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/user/profile")
async def update_profile(profile: ProfileUpdateRequest):
    if not profile.name.strip():
        raise HTTPException(status_code=422, detail="Name cannot be blank.")

    account = await user_collection.find_one({"username": profile.username})
    demo_accounts = {"admin": ("admin", "admin_123"), "user": ("password", "user_456")}
    is_demo_account = (
        profile.username in demo_accounts
        and hmac.compare_digest(profile.password, demo_accounts[profile.username][0])
        and profile.user_id == demo_accounts[profile.username][1]
    )
    if account is None:
        if not is_demo_account:
            raise HTTPException(status_code=401, detail="Could not verify this account. Check your username and password.")
    elif (
        str(account.get("_id")) != profile.user_id
        or not isinstance(account.get("password"), str)
        or not _password_matches(profile.password, account["password"])
    ):
        raise HTTPException(status_code=401, detail="Could not verify this account. Check your username and password.")

    updated_fields = profile.model_dump(
        include={"name", "age", "gender", "height_cm", "weight_kg", "blood_group", "avatar_id"}
    )
    updated_fields["name"] = profile.name.strip()
    avatar_gender = {
        "avatar_1": 1,
        "avatar_2": 0,
        "avatar_3": 1,
        "avatar_4": 0,
        "avatar_5": 1,
        "avatar_6": 0,
    }
    if avatar_gender.get(updated_fields["avatar_id"]) != profile.gender:
        updated_fields["avatar_id"] = "avatar_2" if profile.gender == 0 else "avatar_1"
    if account is not None:
        profile_update: dict[str, Any] = {"$set": updated_fields}
        if not account["password"].startswith("pbkdf2_sha256$"):
            profile_update["$set"]["password"] = _hash_password(profile.password)
        await user_collection.update_one({"_id": account["_id"]}, profile_update)

    return {"status": "Profile updated successfully", "profile": updated_fields}

@app.post("/user/log")
async def log_health_data(user_id: str, data: HealthData):
    log_entry = {"user_id": user_id, "data": data.dict(), "timestamp": datetime.now().isoformat()}
    await save_health_log(log_entry)
    return {"status": "Health data logged successfully"}

@app.get("/user/history/{user_id}")
async def get_history(user_id: str):
    history = await get_health_history(user_id)
    for entry in history:
        entry["_id"] = str(entry["_id"])
    return history

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
