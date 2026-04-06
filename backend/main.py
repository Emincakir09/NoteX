# ==========================================
# 🚨 KRİTİK YAMA (BU KISIM EN ÜSTTE KALMALI)
# ==========================================
import sys
from unittest.mock import MagicMock

# 1. requests_toolbelt Yaması
try:
    import requests_toolbelt.adapters.appengine
except (ImportError, ModuleNotFoundError):
    sys.modules["requests_toolbelt.adapters.appengine"] = MagicMock()

# 2. urllib3 Yaması
m = MagicMock()
m.is_appengine_sandbox = lambda: False
sys.modules["urllib3.contrib.appengine"] = m
# ==========================================

import os
import sys
import time
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from youtube_transcript_api import YouTubeTranscriptApi
from urllib.parse import urlparse, parse_qs
import pyrebase
import firebase_admin
from firebase_admin import credentials, firestore, storage
from dotenv import load_dotenv
import google.generativeai as genai
from langchain_core.messages import HumanMessage, AIMessage
import json
import io
import PyPDF2

# Add parent dir to path so we can import lib
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.rag_service import RAGService

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# --- YAPAY ZEKA AYARLARI ---
api_key = os.getenv("GOOGLE_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

app = FastAPI(title="AkademikAgent SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# 🔑 FIREBASE AYARLARI
# ------------------------------------------------------------------
firebaseConfig = {
  "apiKey": "AIzaSyARecm2N4o4sFsKX4_cso4ASZE0aVTlIY4",
  "authDomain": "akademikagent.firebaseapp.com",
  "projectId": "akademikagent",
  "storageBucket": "akademikagent.firebasestorage.app",
  "messagingSenderId": "1078772904266",
  "appId": "1:1078772904266:web:74e0e86b4418f0c287d1b3",
  "databaseURL": "" 
}

firebase_auth = pyrebase.initialize_app(firebaseConfig)
auth = firebase_auth.auth()

cred_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "serviceAccountKey.json")
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred, {
            'storageBucket': 'akademikagent.firebasestorage.app'
        })
    except Exception as e:
        print(f"Error init Firebase Admin: {e}")

try:
    db = firestore.client()
    bucket = storage.bucket()
except Exception as e:
    db = None
    bucket = None
    print(f"Firestore Client err: {e}")


# --- MODELS ---
class AuthRequest(BaseModel):
    email: str
    password: str

class ChatRequest(BaseModel):
    email: str
    chat_id: str = None
    prompt: str
    selected_docs: list[str] = []

@app.get("/")
def read_root():
    return {"status": "ok", "message": "AkademikAgent API is running smoothly!"}

@app.post("/api/auth/login")
def login(req: AuthRequest):
    try:
        user = auth.sign_in_with_email_and_password(req.email, req.password)
        return {"success": True, "user": user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/register")
def register(req: AuthRequest):
    try:
        user = auth.create_user_with_email_and_password(req.email, req.password)
        return {"success": True, "user": user}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/user/{email}/researches")
def get_researches(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        chats = db.collection("users").document(email).collection("conversations").order_by("created_at", direction=firestore.Query.DESCENDING).get()
        return {
            "researches": [
                {
                    "id": c.id,
                    "title": c.to_dict().get("title", "İsimsiz"),
                    "date": str(c.to_dict().get("created_at")),
                    "sources": c.to_dict().get("sources", []),
                } for c in chats
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# ---------------------------------------------------------------
# Profil Fotoğrafı (Avatar) İşlemleri
# ---------------------------------------------------------------
from fastapi.responses import Response

@app.post("/api/user/avatar")
async def upload_avatar(email: str = Form(...), file: UploadFile = File(...)):
    if not bucket:
        raise HTTPException(status_code=500, detail="Firebase Storage yapılandırılmamış.")
    try:
        file_bytes = await file.read()
        blob = bucket.blob(f"avatars/{email}")
        blob.upload_from_string(file_bytes, content_type=file.content_type)
        return {"success": True, "message": "Profil fotoğrafı güncellendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/avatar")
def get_avatar(email: str):
    if not bucket:
        raise HTTPException(status_code=500, detail="Firebase Storage yapılandırılmamış.")
    try:
        blob = bucket.blob(f"avatars/{email}")
        if not blob.exists():
            raise HTTPException(status_code=404, detail="Avatar bulunamadı.")
        
        content = blob.download_as_bytes()
        return Response(content=content, media_type=blob.content_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_rag_service(email: str):
    parent = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # RAG veritabanı Streamlit ile aynı konumda (chroma_db klasörü değil faiss_index)
    user_db_path = os.path.join(parent, "faiss_index", email.replace('@', '_').replace('.', '_'))
    return RAGService(persistence_path=user_db_path)

SELECTED_MODEL = "gemini-flash-latest"  # Streamlit ile aynı model

# ---------------------------------------------------------------
# Kullanıcı API Key Kaydet / Yükle
# ---------------------------------------------------------------
class ApiKeyRequest(BaseModel):
    email: str
    api_key: str

@app.post("/api/user/apikey")
def save_api_key(req: ApiKeyRequest):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        db.collection("users").document(req.email).set({"api_key": req.api_key}, merge=True)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/apikey")
def get_api_key(email: str):
    if not db:
        return {"api_key": ""}
    try:
        doc = db.collection("users").document(email).get()
        return {"api_key": doc.to_dict().get("api_key", "") if doc.exists else ""}
    except Exception as e:
        return {"api_key": ""}

def get_user_api_key(email: str) -> str:
    """Kullanıcının Firestore'daki API key'ini döner. Yoksa .env key'i kullanılır."""
    try:
        if db:
            doc = db.collection("users").document(email).get()
            if doc.exists:
                key = doc.to_dict().get("api_key", "")
                if key:
                    return key
    except Exception:
        pass
    return os.getenv("GOOGLE_API_KEY", "")

# ---------------------------------------------------------------
# Gemini API çağrısını retry ile yap (429 rate-limit koruması)
# ---------------------------------------------------------------
def call_gemini_with_retry(prompt_text: str, max_retries: int = 3, api_key: str = None):
    """
    Gemini API çağrısını exponential backoff ile tekrar dener.
    api_key belirtilirse o key kullanılır, yoksa .env'deki global key kullanılır.
    429 hatalarında 5s → 10s → 20s bekler.
    """
    import google.generativeai as _genai
    effective_key = api_key or os.getenv("GOOGLE_API_KEY", "")
    if not effective_key:
        raise HTTPException(status_code=400, detail="🔑 Gemini API key bulunamadı. Profil ayarlarından kendi API key'inizi ekleyin.")
    _genai.configure(api_key=effective_key)
    model = _genai.GenerativeModel(SELECTED_MODEL)
    last_error = None
    for attempt in range(max_retries):
        try:
            response = model.generate_content(prompt_text)
            return response.text
        except Exception as e:
            error_str = str(e).lower()
            is_rate_limit = (
                "429" in error_str
                or "resource_exhausted" in error_str
                or "quota" in error_str
                or "rate" in error_str
            )
            if is_rate_limit and attempt < max_retries - 1:
                wait_time = 5 * (2 ** attempt)  # 5s, 10s, 20s
                print(f"⏳ Gemini 429 hatası, {wait_time}s bekleniyor... (deneme {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                last_error = e
            else:
                last_error = e
                break
    # Son hata kontrolü
    error_str = str(last_error).lower()
    is_rate_limit = (
        "429" in error_str
        or "resource_exhausted" in error_str
        or "quota" in error_str
    )
    if is_rate_limit:
        raise HTTPException(
            status_code=429,
            detail="⏳ API kota sınırına ulaşıldı. Gemini ücretsiz plan limitleri aşıldı. "
                   "Lütfen 1-2 dakika bekleyip tekrar deneyin veya Google AI Studio'dan "
                   "API kotanızı kontrol edin: https://ai.google.dev/gemini-api/docs/rate-limits"
        )
    raise HTTPException(status_code=500, detail=str(last_error))

@app.post("/api/chat/message")
def chat_message(req: ChatRequest):
    try:
        rag = get_rag_service(req.email)
        
        # --- Streamlit'teki ask_gemini_rag ile birebir aynı mantık ---
        docs = rag.query(req.prompt, n_results=5, selected_sources=req.selected_docs)
        if not docs:
            return {"reply": "🔍 Seçili belgelerde bu konuyla ilgili bilgi bulamadım."}

        # Langchain Document nesnelerinden context oluştur
        context_text = "\n\n".join([
            f"[Kaynak: {d.metadata.get('source', '')}] {d.page_content}" for d in docs
        ])
        
        prompt = f"""
        Sen akademik bir asistansın. Aşağıdaki bağlama dayanarak soruya cevap ver.
        
        BAĞLAM (Veritabanından Bulunanlar):
        {context_text}
        
        SORU: {req.prompt}
        
        Cevabı Türkçe ver. Markdown formatını kullan.
        Cevabın içinde hangi kaynaktan bilgi aldığını belirtmek için [Kaynak Adı] formatını kullan.
        """
        bot_reply = call_gemini_with_retry(prompt, api_key=get_user_api_key(req.email))
        
        return {"reply": bot_reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# Yardımcı: JSON çıktısını temizle
# ---------------------------------------------------------------
def clean_and_parse_json(raw: str):
    try:
        text = raw.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
    except Exception:
        try:
            start = raw.find("[")
            end = raw.rfind("]") + 1
            if start != -1 and end != 0:
                return json.loads(raw[start:end])
        except Exception:
            pass
        return []

# ---------------------------------------------------------------
# Yardımcı: Dosya türüne göre metin çıkar
# ---------------------------------------------------------------
import tempfile
from docx import Document as DocxDocument

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".wav", ".mp3", ".ogg", ".m4a", ".webm"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".ogg", ".m4a", ".webm"}

def extract_text_from_file(file_bytes: bytes, filename: str) -> str:
    """Dosya türüne göre metin çıkarır. Ses dosyaları için Gemini ile transkript alır."""
    ext = os.path.splitext(filename)[1].lower()

    if ext == ".pdf":
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        total_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                total_text += text + "\n"
        return total_text

    elif ext in (".docx", ".doc"):
        doc = DocxDocument(io.BytesIO(file_bytes))
        return "\n".join([p.text for p in doc.paragraphs if p.text.strip()])

    elif ext == ".txt":
        # UTF-8 dene, olmazsa latin-1
        try:
            return file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            return file_bytes.decode("latin-1", errors="replace")

    elif ext in AUDIO_EXTENSIONS:
        # Gemini multimodal API ile ses → metin
        tmp_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name
            uploaded = genai.upload_file(tmp_path)
            # İşlenmesini bekle
            while uploaded.state.name == "PROCESSING":
                time.sleep(1)
                uploaded = genai.get_file(uploaded.name)
            model = genai.GenerativeModel(SELECTED_MODEL)
            result = model.generate_content([uploaded, "Bu ses dosyasındaki içeriği ders notu olarak metin formatında çıkar. Türkçe yaz."])
            return result.text
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

    else:
        raise ValueError(f"Desteklenmeyen dosya türü: {ext}")

# ---------------------------------------------------------------
# Evrensel Dosya Yükle (PDF, Word, TXT, Ses)
# ---------------------------------------------------------------
@app.post("/api/upload/document")
async def upload_document(
    email: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"Desteklenmeyen dosya türü: {ext}. Desteklenen: PDF, Word, TXT, WAV, MP3, OGG, M4A"
            )

        file_bytes = await file.read()

        # Metin çıkar
        total_text = extract_text_from_file(file_bytes, file.filename)

        if len(total_text.strip()) < 10:
            raise HTTPException(status_code=422, detail="Dosya okunamadı veya yeterli metin bulunamadı.")

        # RAG'e ekle
        rag = get_rag_service(email)
        success, msg = rag.ingest_text(total_text, source_name=file.filename)
        if not success:
            raise HTTPException(status_code=500, detail=msg)

        # Firebase Storage'a yükle (isteğe bağlı)
        try:
            if bucket:
                blob_path = f"users/{email}/{file.filename}"
                blob = bucket.blob(blob_path)
                content_type = file.content_type or "application/octet-stream"
                blob.upload_from_string(file_bytes, content_type=content_type)
                if db:
                    ref = db.collection("users").document(email).collection("files").document()
                    ref.set({"name": file.filename, "path": blob_path, "type": content_type})
        except Exception:
            pass

        file_type_label = "🎵 Ses" if ext in AUDIO_EXTENSIONS else "📄 Belge"
        return {"success": True, "filename": file.filename, "message": f"{file_type_label} '{file.filename}' başarıyla işlendi ve RAG'e eklendi."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# YouTube Linki Yükle ve RAG'e Ekle
# ---------------------------------------------------------------
class YouTubeRequest(BaseModel):
    email: str
    url: str

def extract_youtube_code(url: str):
    parsed = urlparse(url)
    if "youtu.be" in parsed.netloc:
        return parsed.path.lstrip("/")
    elif "youtube.com" in parsed.netloc:
        return parse_qs(parsed.query).get("v", [None])[0]
    return None

@app.post("/api/upload/youtube")
def upload_youtube(req: YouTubeRequest):
    video_id = extract_youtube_code(req.url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Geçersiz YouTube linki. youtube.com veya youtu.be linki girmelisiniz.")
        
    try:
        # 1. Altyazı/transkript zinciri: Türkçe → İngilizce → herhangi bir dil
        transcript_data = None
        for langs in (['tr'], ['en'], None):
            try:
                if langs:
                    transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=langs)
                else:
                    transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
                break
            except Exception:
                continue

        if transcript_data:
            text = " ".join([t.get('text', '') for t in transcript_data])
        else:
            # 2. Altyazı yoksa → yt-dlp ile sesi indir → Gemini audio transcription
            import yt_dlp, tempfile, os as _os
            tmp_dir = tempfile.mkdtemp()
            tmp_audio = _os.path.join(tmp_dir, "audio.m4a")
            try:
                ydl_opts = {
                    "format": "bestaudio[ext=m4a]/bestaudio/best",
                    "outtmpl": tmp_audio,
                    "quiet": True,
                    "no_warnings": True,
                    "postprocessors": [],
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([req.url])

                # İndirilen dosyayı oku — mevcut audio pipeline'ı kullan
                actual_file = tmp_audio if _os.path.exists(tmp_audio) else next(
                    (f for f in [tmp_audio + ext for ext in [".m4a", ".webm", ".mp4", ".opus", ""]] if _os.path.exists(f)), None
                )
                if not actual_file:
                    raise Exception("Ses dosyası indirilemedi.")

                user_key = get_user_api_key(req.email)
                with open(actual_file, "rb") as f:
                    audio_bytes = f.read()
                ext = _os.path.splitext(actual_file)[1] or ".m4a"
                text = extract_text_from_file(audio_bytes, f"audio{ext}")
            finally:
                import shutil
                shutil.rmtree(tmp_dir, ignore_errors=True)


        if not text or len(text.strip()) < 10:
            raise Exception("Video içeriği alınamadı.")

        rag = get_rag_service(req.email)
        filename = f"YouTube Video ({video_id})"
        success, msg = rag.ingest_text(text, source_name=filename)

        if not success:
            raise HTTPException(status_code=500, detail=msg)

        return {"success": True, "filename": filename, "message": "📺 YouTube videosu başarıyla işlendi ve RAG'e eklendi."}
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        if "Could not retrieve a transcript" in err_str or "no element" in err_str.lower():
            err_str = "Bu videoda alınabilir bir altyazı bulunmamaktadır."
        raise HTTPException(status_code=400, detail=f"Altyazı alınamadı: {err_str}")



# Geriye uyumluluk: eski PDF endpoint'i de çalışsın
@app.post("/api/upload/pdf")
async def upload_pdf(email: str = Form(...), file: UploadFile = File(...)):
    return await upload_document(email=email, file=file)

# ---------------------------------------------------------------
# Yüklü Belgeleri Listele
# ---------------------------------------------------------------
@app.get("/api/user/{email}/documents")
def get_user_documents(email: str):
    try:
        rag = get_rag_service(email)
        docs = list(rag.document_registry.keys()) if rag.document_registry else []
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# SINAV (Quiz) Oluştur
# ---------------------------------------------------------------
class QuizRequest(BaseModel):
    email: str
    selected_docs: list[str] = []

@app.post("/api/quiz/generate")
def generate_quiz(req: QuizRequest):
    try:
        rag = get_rag_service(req.email)
        full_context = rag.get_full_text(req.selected_docs)
        if not full_context:
            raise HTTPException(status_code=422, detail="Seçili belgelerde metin bulunamadı.")

        prompt = f"""
        Aşağıdaki ders materyallerine dayanarak, zorluk derecesi yüksek 5 adet çoktan seçmeli sınav sorusu hazırla.
        Sorular metnin geneline yayılsın.
        
        MATERYAL:
        {full_context[:300000]}
        
        Çıktı SADECE ve SADECE JSON formatında olsun, başka hiçbir şey ekleme.
        Format: [ {{"soru": "...", "secenekler": ["A) ...", "B) ...", "C) ...", "D) ..."], "dogru_cevap": "A) ..."}} ]
        """
        raw_response = call_gemini_with_retry(prompt, api_key=get_user_api_key(req.email))
        quiz_data = clean_and_parse_json(raw_response)
        if not quiz_data:
            raise HTTPException(status_code=500, detail="Sınav oluşturulamadı.")
        return {"quiz": quiz_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# BİLGİ KARTLARI (Flashcards) Oluştur
# ---------------------------------------------------------------
@app.post("/api/cards/generate")
def generate_cards(req: QuizRequest):
    try:
        rag = get_rag_service(req.email)
        full_context = rag.get_full_text(req.selected_docs)
        if not full_context:
            raise HTTPException(status_code=422, detail="Seçili belgelerde metin bulunamadı.")

        prompt = f"""
        Aşağıdaki ders materyalinden 15 adet bilgi kartı çıkar.
        Her kart üç alandan oluşsun:
          - "kavram": kısa terim veya başlık (max 8 kelime)
          - "tanim": net ve öğretici açıklama (2-4 cümle)
          - "kategori": tek kelimelik alan etiketi (örn. "Tanım", "Yöntem", "İlke", "Formül")

        Çıktı SADECE ve SADECE JSON listesi olsun.
        Format:
        [
          {{"kavram": "...", "tanim": "...", "kategori": "..."}},
          ...
        ]

        MATERYAL:
        {full_context[:80000]}
        """
        raw_response = call_gemini_with_retry(prompt, api_key=get_user_api_key(req.email))
        cards = clean_and_parse_json(raw_response)
        if not isinstance(cards, list):
            raise HTTPException(status_code=500, detail="Kart oluşturulamadı.")
        return {"cards": cards}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# KAVRAM HARİTASI Oluştur
# ---------------------------------------------------------------
@app.post("/api/map/generate")
def generate_map(req: QuizRequest):
    try:
        rag = get_rag_service(req.email)
        full_context = rag.get_full_text(req.selected_docs)
        if not full_context:
            raise HTTPException(status_code=422, detail="Seçili belgelerde metin bulunamadı.")

        prompt = f"""
        Aşağıdaki metindeki ana teknik kavramları ve aralarındaki ilişkileri JSON listesi olarak çıkar.
        En fazla 25 ilişki çıkar.
        
        MATERYAL:
        {full_context[:100000]}
        
        Çıktı SADECE JSON olsun.
        Format: [ {{"source": "Kavram A", "target": "Kavram B", "relation": "..."}} ]
        """
        raw_response = call_gemini_with_retry(prompt, api_key=get_user_api_key(req.email))
        relationships = clean_and_parse_json(raw_response)
        if not relationships:
            raise HTTPException(status_code=500, detail="Harita verisi oluşturulamadı.")
        return {"relationships": relationships}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------------------------------------------------
# ANALİTİK - Quiz Geçmişi
# ---------------------------------------------------------------
@app.post("/api/quiz/save-score")
def save_quiz_score(req: dict):
    try:
        email = req.get("email")
        score = req.get("score", 0)
        total = req.get("total", 0)
        doc_names = req.get("documents", [])
        if not db:
            raise HTTPException(status_code=500, detail="DB Error")
        db.collection("users").document(email).collection("quiz_history").add({
            "score": score,
            "total": total,
            "percentage": round((score / total) * 100) if total > 0 else 0,
            "documents": doc_names,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/quiz-history")
def get_quiz_history(email: str):
    try:
        if not db:
            return {"history": []}
        docs = (
            db.collection("users").document(email).collection("quiz_history")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(20).get()
        )
        results = []
        for d in docs:
            data = d.to_dict()
            results.append({
                "score": data.get("score", 0),
                "total": data.get("total", 0),
                "percentage": data.get("percentage", 0),
                "documents": data.get("documents", []),
            })
        return {"history": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# ARAŞTIRMA (CONVERSATION) YÖNETİMİ - Streamlit ile birebir aynı
# ================================================================

class ResearchCreateRequest(BaseModel):
    email: str
    title: str = "Yeni Sohbet"

@app.post("/api/research/create")
def create_research(req: ResearchCreateRequest):
    """Yeni bir araştırma (sohbet oturumu) oluşturur - Firestore"""
    if not db:
        raise HTTPException(status_code=500, detail="Firestore bağlantısı yok")
    try:
        ref = db.collection("users").document(req.email).collection("conversations").document()
        ref.set({
            "title": req.title,
            "created_at": firestore.SERVER_TIMESTAMP,
            "sources": [],
        })
        return {"id": ref.id, "title": req.title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/research/{email}/{research_id}")
def delete_research(email: str, research_id: str):
    """Araştırmayı siler"""
    if not db:
        raise HTTPException(status_code=500, detail="Firestore bağlantısı yok")
    try:
        db.collection("users").document(email).collection("conversations").document(research_id).delete()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/research/{email}/{research_id}/sources")
def update_research_sources(email: str, research_id: str, body: dict):
    """Araştırmaya ait kaynak belgeleri günceller"""
    if not db:
        return {"success": False}
    try:
        db.collection("users").document(email).collection("conversations").document(research_id).update({
            "sources": body.get("sources", [])
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# MESAJ KAYDETME / YÜKLEME - Streamlit ile birebir aynı
# ================================================================

class MessageRequest(BaseModel):
    email: str
    chat_id: str
    role: str        # "user" | "assistant"
    content: str

@app.post("/api/messages/save")
def save_message(req: MessageRequest):
    """Mesajı Firestore'a kaydeder ve ilk mesajsa başlığı günceller"""
    if not db:
        return {"success": False}
    try:
        col = db.collection("users").document(req.email).collection("conversations").document(req.chat_id)
        col.collection("messages").document().set({
            "role": req.role,
            "content": req.content,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        # İlk kullanıcı mesajıysa başlığı otomatik güncelle
        if req.role == "user":
            try:
                current = col.get().to_dict() or {}
                if current.get("title", "") in ("Yeni Sohbet", ""):
                    new_title = req.content[:30] + "..." if len(req.content) > 30 else req.content
                    col.update({"title": new_title})
            except Exception:
                pass
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/messages/{email}/{chat_id}")
def load_messages(email: str, chat_id: str):
    """Bir araştırmaya ait tüm mesajları getirir"""
    if not db:
        return {"messages": []}
    try:
        msgs = (
            db.collection("users").document(email)
            .collection("conversations").document(chat_id)
            .collection("messages")
            .order_by("timestamp")
            .get()
        )
        return {
            "messages": [
                {"role": m.to_dict()["role"], "content": m.to_dict()["content"]}
                for m in msgs
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# BİLGİ KARTLARI KAYDET / YÜKLE - Firestore'a per-research
# ================================================================

class SaveCardsRequest(BaseModel):
    email: str
    research_id: str
    cards: list

@app.post("/api/cards/save")
def save_cards(req: SaveCardsRequest):
    if not db:
        return {"success": False}
    try:
        db.collection("users").document(req.email).collection("conversations").document(req.research_id).collection("flashcards").document("latest").set({
            "data": req.cards,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cards/{email}/{research_id}")
def load_cards(email: str, research_id: str):
    if not db:
        return {"cards": []}
    try:
        doc = db.collection("users").document(email).collection("conversations").document(research_id).collection("flashcards").document("latest").get()
        return {"cards": doc.to_dict().get("data", []) if doc.exists else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# KAVRAM HARİTASI KAYDET / YÜKLE  - Firestore'a per-research
# ================================================================

class SaveMapRequest(BaseModel):
    email: str
    research_id: str
    relationships: list

@app.post("/api/map/save")
def save_map(req: SaveMapRequest):
    if not db:
        return {"success": False}
    try:
        db.collection("users").document(req.email).collection("conversations").document(req.research_id).collection("maps").document("latest").set({
            "data": req.relationships,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/map/{email}/{research_id}")
def load_map(email: str, research_id: str):
    if not db:
        return {"relationships": []}
    try:
        doc = db.collection("users").document(email).collection("conversations").document(research_id).collection("maps").document("latest").get()
        return {"relationships": doc.to_dict().get("data", []) if doc.exists else []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# CHAT ENDPOINT - Firestore'a otomatik kayıt ile geliştirilmiş versiyon
# ================================================================

@app.post("/api/chat/message-with-save")
def chat_message_with_save(req: ChatRequest):
    """
    Chat isteğini işler VE Firestore'a otomatik kaydeder.
    chat_id yoksa yeni araştırma oluşturur.
    """
    try:
        current_chat_id = req.chat_id

        # 1. Eğer chat_id yoksa, yeni araştırma oluştur
        if not current_chat_id and db:
            try:
                ref = db.collection("users").document(req.email).collection("conversations").document()
                ref.set({"title": "Yeni Sohbet", "created_at": firestore.SERVER_TIMESTAMP, "sources": req.selected_docs})
                current_chat_id = ref.id
            except Exception:
                pass

        # 2. Kullanıcı mesajını kaydet
        if db and current_chat_id:
            try:
                col = db.collection("users").document(req.email).collection("conversations").document(current_chat_id)
                col.collection("messages").document().set({"role": "user", "content": req.prompt, "timestamp": firestore.SERVER_TIMESTAMP})
                current_doc = col.get().to_dict() or {}
                if current_doc.get("title", "") in ("Yeni Sohbet", ""):
                    new_title = req.prompt[:30] + "..." if len(req.prompt) > 30 else req.prompt
                    col.update({"title": new_title})
                if req.selected_docs:
                    col.update({"sources": req.selected_docs})
            except Exception:
                pass

        # 3. RAG + Gemini cevap üret (aynı mantık)
        rag = get_rag_service(req.email)
        docs = rag.query(req.prompt, n_results=5, selected_sources=req.selected_docs)

        if not docs:
            bot_reply = "🔍 Seçili belgelerde bu konuyla ilgili bilgi bulamadım. Belge seçmeyi veya belge yüklemeyi deneyin."
        else:
            context_text = "\n\n".join([f"[Kaynak: {d.metadata.get('source', '')}] {d.page_content}" for d in docs])
            prompt_text = f"""
            Sen akademik bir asistansın. Aşağıdaki bağlama dayanarak soruya cevap ver.
            
            BAĞLAM (Veritabanından Bulunanlar):
            {context_text}
            
            SORU: {req.prompt}
            
            Cevabı Türkçe ver. Markdown formatını kullan.
            Cevabın içinde hangi kaynaktan bilgi aldığını belirtmek için [Kaynak Adı] formatını kullan.
            """
            bot_reply = call_gemini_with_retry(prompt_text, api_key=get_user_api_key(req.email))

        # 4. Assistant cevabını kaydet
        if db and current_chat_id:
            try:
                db.collection("users").document(req.email).collection("conversations").document(current_chat_id).collection("messages").document().set(
                    {"role": "assistant", "content": bot_reply, "timestamp": firestore.SERVER_TIMESTAMP}
                )
            except Exception:
                pass

        return {"reply": bot_reply, "chat_id": current_chat_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# SOHBETİ TEMİZLE
# ================================================================
@app.delete("/api/research/{email}/{research_id}/messages")
def clear_chat_messages(email: str, research_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        messages_ref = db.collection("users").document(email).collection("conversations").document(research_id).collection("messages")
        docs = messages_ref.get()
        for d in docs:
            d.reference.delete()
        return {"success": True, "message": "Mesajlar silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# SORU HAVUZU (QUESTION POOL)
# ================================================================

class QuestionPoolItem(BaseModel):
    questionText: str
    options: list
    correctAnswer: str
    explanation: str

class CardPoolItem(BaseModel):
    kavram: str
    tanim: str
    kategori: str

@app.post("/api/user/{email}/question_pool")
def save_question(email: str, req: QuestionPoolItem):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        data = req.dict()
        data["timestamp"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(email).collection("question_pool").add(data)
        return {"success": True, "message": "Soru havuza eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/question_pool")
def get_question_pool(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        pool_ref = db.collection("users").document(email).collection("question_pool").order_by("timestamp", direction=firestore.Query.DESCENDING).get()
        questions = []
        for p in pool_ref:
            q = p.to_dict()
            q["id"] = p.id
            if "timestamp" in q and q["timestamp"]:
                q["timestamp"] = str(q["timestamp"])
            questions.append(q)
        return {"questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user/{email}/question_pool/{question_id}")
def delete_question(email: str, question_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        db.collection("users").document(email).collection("question_pool").document(question_id).delete()
        return {"success": True, "message": "Soru havuzdan silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- KART HAVUZU ---

@app.post("/api/user/{email}/card_pool")
def save_card(email: str, req: CardPoolItem):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        data = req.dict()
        data["timestamp"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(email).collection("card_pool").add(data)
        return {"success": True, "message": "Kart havuza eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/card_pool")
def get_card_pool(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        pool_ref = db.collection("users").document(email).collection("card_pool").order_by("timestamp", direction=firestore.Query.DESCENDING).get()
        cards = []
        for p in pool_ref:
            c = p.to_dict()
            c["id"] = p.id
            if "timestamp" in c and c["timestamp"]:
                c["timestamp"] = str(c["timestamp"])
            cards.append(c)
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user/{email}/card_pool/{card_id}")
def delete_card(email: str, card_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        db.collection("users").document(email).collection("card_pool").document(card_id).delete()
        return {"success": True, "message": "Kart havuzdan silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# KEŞFET (DISCOVER) SİSTEMİ (BEĞENİ VE YORUM İLE)
# ================================================================
import datetime

class DiscoverItem(BaseModel):
    authorEmail: str
    authorUsername: str = None
    type: str = "question" # "question" | "card"
    # Question fields
    questionText: str = None
    options: list = None
    correctAnswer: str = None
    explanation: str = None
    # Card fields
    kavram: str = None
    tanim: str = None
    kategori: str = None

class CommentItem(BaseModel):
    authorEmail: str
    authorUsername: str = None
    text: str

@app.post("/api/discover")
def share_to_discover(req: DiscoverItem):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        data = req.dict()
        data["timestamp"] = firestore.SERVER_TIMESTAMP
        data["likes"] = []
        data["comments"] = []
        db.collection("discover").add(data)
        return {"success": True, "message": "Keşfet'te paylaşıldı!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/discover")
def get_discover_feed():
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        feed_ref = db.collection("discover").order_by("timestamp", direction=firestore.Query.DESCENDING).get()
        feed = []
        for p in feed_ref:
            q = p.to_dict()
            q["id"] = p.id
            if "timestamp" in q and q["timestamp"]:
                q["timestamp"] = str(q["timestamp"])
            feed.append(q)
        return {"feed": feed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/discover/{question_id}/like")
def toggle_like_discover(question_id: str, payload: dict):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email required")
            
        doc_ref = db.collection("discover").document(question_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Soru bulunamadı")
            
        data = doc.to_dict()
        likes = data.get("likes", [])
        
        if email in likes:
            likes.remove(email)
            liked = False
        else:
            likes.append(email)
            liked = True
            
        doc_ref.update({"likes": likes})
        return {"success": True, "liked": liked, "likes_count": len(likes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/discover/{question_id}/comment")
def add_comment_discover(question_id: str, req: CommentItem):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        doc_ref = db.collection("discover").document(question_id)
        
        comment_data = {
            "authorEmail": req.authorEmail,
            "text": req.text,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
        doc_ref.update({
            "comments": firestore.ArrayUnion([comment_data])
        })
        return {"success": True, "comment": comment_data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/discover/{question_id}/{email}")
def delete_discover_post(question_id: str, email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        doc_ref = db.collection("discover").document(question_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Soru bulunamadı")
            
        data = doc.to_dict()
        if data.get("authorEmail").lower() != email.lower():
            raise HTTPException(status_code=403, detail="Bu paylaşımı silme yetkiniz yok.")
            
        doc_ref.delete()
        
        # Kullanıcının question_pool veya discover_attempts'ten silmeyebiliriz, bu normal.
        return {"success": True, "message": "Gönderi silindi"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AttemptItem(BaseModel):
    questionId: str
    selectedOption: str
    isCorrect: bool

@app.get("/api/user/{email}/discover_attempts")
def get_discover_attempts(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        docs = db.collection("users").document(email).collection("discover_attempts").get()
        attempts = {}
        for d in docs:
            dt = d.to_dict()
            attempts[dt["questionId"]] = {
                "selected": dt["selectedOption"],
                "isCorrect": dt["isCorrect"]
            }
        return {"attempts": attempts}
    except Exception as e:
        print(f"Error fetching attempts: {e}")
        return {"attempts": {}}

        return {"success": True, "message": "Soru havuzdan silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- KART HAVUZU ---

@app.post("/api/user/{email}/card_pool")
def save_card(email: str, req: CardPoolItem):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        data = req.dict()
        data["timestamp"] = firestore.SERVER_TIMESTAMP
        db.collection("users").document(email).collection("card_pool").add(data)
        return {"success": True, "message": "Kart havuza eklendi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{email}/card_pool")
def get_card_pool(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        pool_ref = db.collection("users").document(email).collection("card_pool").order_by("timestamp", direction=firestore.Query.DESCENDING).get()
        cards = []
        for p in pool_ref:
            c = p.to_dict()
            c["id"] = p.id
            if "timestamp" in c and c["timestamp"]:
                c["timestamp"] = str(c["timestamp"])
            cards.append(c)
        return {"cards": cards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/user/{email}/card_pool/{card_id}")
def delete_card(email: str, card_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        db.collection("users").document(email).collection("card_pool").document(card_id).delete()
        return {"success": True, "message": "Kart havuzdan silindi."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ================================================================
# KULLANICI ADI (USERNAME) YÖNETİMİ
# ================================================================
import re

class UsernameRequest(BaseModel):
    username: str

@app.get("/api/user/{email}/profile")
def get_user_profile(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        user_doc = db.collection("users").document(email).get()
        data = user_doc.to_dict() if user_doc.exists else {}
        return {"username": data.get("username", "")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/user/{email}/username")
def set_username(email: str, req: UsernameRequest):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    
    new_username = req.username.strip().lower()
    if not new_username or len(new_username) < 3:
        raise HTTPException(status_code=400, detail="Kullanıcı adı en az 3 karakter olmalıdır.")
    
    if not re.match(r"^[a-z0-9_]+$", new_username):
        raise HTTPException(status_code=400, detail="Sadece küçük harf, rakam ve altçizgi (_) kullanabilirsiniz.")

    try:
        username_ref = db.collection("usernames").document(new_username)
        username_doc = username_ref.get()
        
        if username_doc.exists:
            owner = username_doc.to_dict().get("email")
            if owner != email:
                raise HTTPException(status_code=400, detail="Bu kullanıcı adı başka biri tarafından alınmış.")
        
        user_ref = db.collection("users").document(email)
        user_doc = user_ref.get()
        old_username = user_doc.to_dict().get("username") if user_doc.exists else None
        
        if old_username and old_username != new_username:
            db.collection("usernames").document(old_username).delete()
            
        username_ref.set({"email": email})
        user_ref.set({"username": new_username}, merge=True)
        return {"success": True, "username": new_username}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================================================================
# NOTEBOOKS YÖNETİMİ
# ================================================================

class NoteCreate(BaseModel):
    title: str

class NoteUpdate(BaseModel):
    pages: list[str]
    
@app.get("/api/notes/{email}")
def get_user_notes(email: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        docs = db.collection("users").document(email).collection("notes").order_by("updated_at", direction=firestore.Query.DESCENDING).get()
        notes = []
        for d in docs:
            dt = d.to_dict()
            dt["id"] = d.id
            if "updated_at" in dt and hasattr(dt["updated_at"], "isoformat"):
                dt["updated_at"] = dt["updated_at"].isoformat()
            elif "updated_at" in dt:
                dt["updated_at"] = str(dt["updated_at"])
                
            # Backward compatibility
            if "pages" not in dt:
                dt["pages"] = [dt.get("content", "")]
                
            notes.append(dt)
        return {"notes": notes}
    except Exception as e:
        print(f"Error fetching notes: {e}")
        return {"notes": []}

@app.post("/api/notes/{email}")
def create_note(email: str, req: NoteCreate):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        ref = db.collection("users").document(email).collection("notes").document()
        new_note = {
            "title": req.title,
            "pages": [""],
            "updated_at": firestore.SERVER_TIMESTAMP
        }
        ref.set(new_note)
        return {"success": True, "id": ref.id, "title": req.title, "pages": [""]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/notes/{email}/{note_id}")
def update_note(email: str, note_id: str, req: NoteUpdate):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        ref = db.collection("users").document(email).collection("notes").document(note_id)
        ref.update({
            "pages": req.pages,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notes/{email}/{note_id}")
def delete_note(email: str, note_id: str):
    if not db:
        raise HTTPException(status_code=500, detail="DB Error")
    try:
        db.collection("users").document(email).collection("notes").document(note_id).delete()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 10000))
    uvicorn.run(app, host="0.0.0.0", port=port)
