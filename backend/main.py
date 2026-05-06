from __future__ import annotations
import hashlib
import json
import os
import sqlite3
from contextlib import asynccontextmanager
from typing import List, Optional
from urllib.parse import urlparse
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from config import get_gemini_api_key
from summarize import summarize_text, get_summary_stats, get_analysis_segments
from chat import create_chat_session

load_dotenv()

APP_TITLE = "Sozlesme Ozetleyici API"
GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "links.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS links (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                url_hash     TEXT    NOT NULL UNIQUE,
                raw_url      TEXT    NOT NULL,
                summary_data TEXT,
                site_name    TEXT,
                created_at   DATETIME NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_links_url_hash   ON links (url_hash)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_links_site_name  ON links (site_name)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_links_created_at ON links (created_at)")
        conn.commit()


def save_link(raw_url: str, summary_data: str, site_name: Optional[str]) -> None:
    """Insert a link record; silently skip if the URL was already saved."""
    url_hash = hashlib.sha256(raw_url.encode()).hexdigest()
    with get_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO links (url_hash, raw_url, summary_data, site_name)
                VALUES (?, ?, ?, ?)
                """,
                (url_hash, raw_url, summary_data, site_name),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass  # URL already exists — no duplicate


def get_all_links() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM links ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]


def get_link_by_url(raw_url: str) -> Optional[dict]:
    url_hash = hashlib.sha256(raw_url.encode()).hexdigest()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM links WHERE url_hash = ?", (url_hash,)
        ).fetchone()
        return dict(row) if row else None


def get_link_by_hash(url_hash: str) -> Optional[dict]:
    """Get summary data by hash from database."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM links WHERE url_hash = ?", (url_hash,)
        ).fetchone()
        return dict(row) if row else None


def save_text_summary(text: str, summary_data: str, url: Optional[str] = None) -> None:
    """Save text summary with text hash. If URL provided, use it as raw_url."""
    text_hash = hashlib.sha256(text.encode()).hexdigest()
    raw_url = url if url else f"text_hash_{text_hash[:16]}"
    site_name = urlparse(url).netloc if url else None
    
    with get_connection() as conn:
        try:
            conn.execute(
                """
                INSERT INTO links (url_hash, raw_url, summary_data, site_name)
                VALUES (?, ?, ?, ?)
                """,
                (text_hash, raw_url, summary_data, site_name),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            pass  # Hash already exists — no duplicate


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    url: Optional[str] = None
    title: Optional[str] = None


class AnalysisSegment(BaseModel):
    id: int
    text: str
    risk_level: str  # "red", "yellow", "green"
    reason: str


class SummaryStats(BaseModel):
    risk_score: int  # 1-10
    overall_summary: str
    critical_highlight: str


class SummaryResponse(BaseModel):
    error: bool = False
    summary_stats: Optional[SummaryStats] = None
    analysis_segments: Optional[List[AnalysisSegment]] = None
    message: Optional[str] = None


class ChatMessage(BaseModel):
    user_id: Optional[str] = None
    contract_text: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


class ChatResponse(BaseModel):
    response: str
    language_detected: Optional[str] = None


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown events."""
    # Startup event
    init_db()
    yield
    # Shutdown event (if needed)


app = FastAPI(title=APP_TITLE, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def build_prompt(text: str, title: Optional[str], url: Optional[str]) -> str:
    """Legacy function - kept for backward compatibility."""
    meta = []
    if title:
        meta.append(f"Baslik: {title}")
    if url:
        meta.append(f"URL: {url}")
    meta_block = "\n".join(meta)

    return (
        "Sen bir hukuk metni ozetleyicisin. Ciktiyi yalnizca asagidaki JSON "
        "formatinda ver:\n"
        '{\n  "risk_score": 0-100,\n  "summary_points": [""],\n'
        '  "risks": [""],\n  "notes": [""]\n}\n\n'
        f"{meta_block}\n\nMetin:\n{text}"
    )


async def call_gemini_legacy(prompt: str) -> dict:
    """Legacy function - kept for backward compatibility."""
    api_key = os.getenv("GEMINI_API_KEY", "API_Buraya_Gelecek")
    gemini_url = os.getenv("GEMINI_API_URL", DEFAULT_GEMINI_URL)

    if api_key == "API_Buraya_Gelecek":
        return {
            "error": True,
            "message": "GEMINI_API_KEY not configured"
        }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ]
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            gemini_url,
            params={"key": api_key},
            headers={"Content-Type": "application/json"},
            json=payload,
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini API hatasi: {response.status_code}",
        )

    data = response.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )

    try:
        parsed = json.loads(text)
        return {
            "error": False,
            "data": parsed
        }
    except (json.JSONDecodeError, TypeError, ValueError):
        return {
            "error": True,
            "message": "Failed to parse response"
        }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(payload: SummarizeRequest) -> SummaryResponse:
    """Summarize a privacy agreement or legal text.
    
    Checks cache first:
    1. Creates hash of the text
    2. Checks if summary exists in database
    3. If exists, returns cached summary
    4. If not, generates new summary and saves it
    """
    # 1. Hash text for caching
    text_hash = hashlib.sha256(payload.text.encode()).hexdigest()
    
    # 2. Check if summary already exists in database
    cached = get_link_by_hash(text_hash)
    if cached and cached.get("summary_data"):
        try:
            cached_result = json.loads(cached["summary_data"])
            if not cached_result.get("error"):
                print(f"Using stored summary for text hash: {text_hash[:16]}...")
                return SummaryResponse(
                    error=False,
                    summary_stats=SummaryStats(
                        risk_score=cached_result["summary_stats"]["risk_score"],
                        overall_summary=cached_result["summary_stats"]["overall_summary"],
                        critical_highlight=cached_result["summary_stats"]["critical_highlight"],
                    ),
                    analysis_segments=[
                        AnalysisSegment(
                            id=seg["id"],
                            text=seg["text"],
                            risk_level=seg["risk_level"],
                            reason=seg["reason"],
                        )
                        for seg in cached_result.get("analysis_segments", [])
                    ]
                )
        except Exception as e:
            print(f"Warning: Could not use cache: {e}")
    
    # 3. Generate new summary
    print(f"Generating new summary for text hash: {text_hash[:16]}...")
    result = summarize_text(payload.text)

    # Handle errors from summarize module
    if result.get("error"):
        return SummaryResponse(
            error=True,
            message=result.get("message", "Unknown error occurred")
        )

    # 4. Save to database
    save_text_summary(
        text=payload.text,
        summary_data=json.dumps(result),
        url=payload.url
    )
    print(f"Summary saved with text hash: {text_hash[:16]}...")

    # Format response
    return SummaryResponse(
        error=False,
        summary_stats=SummaryStats(
            risk_score=result["summary_stats"]["risk_score"],
            overall_summary=result["summary_stats"]["overall_summary"],
            critical_highlight=result["summary_stats"]["critical_highlight"],
        ),
        analysis_segments=[
            AnalysisSegment(
                id=seg["id"],
                text=seg["text"],
                risk_level=seg["risk_level"],
                reason=seg["reason"],
            )
            for seg in result.get("analysis_segments", [])
        ]
    )


@app.post("/chat")
async def chat(payload: ChatMessage) -> ChatResponse:
    """Answer questions about a privacy agreement."""
    try:
        session = create_chat_session(
            payload.contract_text,
            summary=None  
        )
        response_text = session.ask(payload.message)
        
        return ChatResponse(
            response=response_text
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat error: {str(e)}"
        )


@app.get("/links", response_model=List[dict])
def list_links() -> list[dict]:
    """Return all saved links ordered by most recent."""
    return get_all_links()


@app.get("/links/search")
def search_link(url: str) -> Optional[dict]:
    """Look up a previously summarized URL."""
    return get_link_by_url(url)


if __name__ == "__main__":
    import uvicorn
    print("Sunucu başlatılıyor: http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
