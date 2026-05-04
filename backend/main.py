from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from typing import List, Optional
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=1)
    url: Optional[str] = None
    title: Optional[str] = None


class SummaryResponse(BaseModel):
    risk_score: int
    summary_points: List[str]
    risks: List[str]
    notes: List[str]
    model: str


class LinkRecord(BaseModel):
    id: int
    url_hash: str
    raw_url: str
    summary_data: Optional[str]
    site_name: Optional[str]
    created_at: str


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    """Create the database and tables when the server starts."""
    init_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def build_prompt(text: str, title: Optional[str], url: Optional[str]) -> str:
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


async def call_gemini(prompt: str) -> SummaryResponse:
    api_key = os.getenv("GEMINI_API_KEY", "API_Buraya_Gelecek")
    gemini_url = os.getenv("GEMINI_API_URL", DEFAULT_GEMINI_URL)

    if api_key == "API_Buraya_Gelecek":
        return SummaryResponse(
            risk_score=0,
            summary_points=["API_Buraya_Gelecek olarak ayarlanmis."],
            risks=[],
            notes=["GEMINI_API_KEY .env icinden doldurulmali."],
            model=GEMINI_MODEL,
        )

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
        return SummaryResponse(
            risk_score=int(parsed.get("risk_score", 0)),
            summary_points=list(parsed.get("summary_points", [])),
            risks=list(parsed.get("risks", [])),
            notes=list(parsed.get("notes", [])),
            model=GEMINI_MODEL,
        )
    except (json.JSONDecodeError, TypeError, ValueError):
        return SummaryResponse(
            risk_score=0,
            summary_points=["Model JSON disi cikti uretti."],
            risks=[],
            notes=[text or "Bos yanit."],
            model=GEMINI_MODEL,
        )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(payload: SummarizeRequest) -> SummaryResponse:
    prompt = build_prompt(payload.text, payload.title, payload.url)
    result = await call_gemini(prompt)

    # Save to database if a URL was provided
    if payload.url:
        site_name = urlparse(payload.url).netloc or None
        save_link(
            raw_url=payload.url,
            summary_data=result.model_dump_json(),
            site_name=site_name,
        )

    return result


@app.get("/links", response_model=List[LinkRecord])
def list_links() -> list[dict]:
    """Return all saved links ordered by most recent."""
    return get_all_links()


@app.get("/links/search", response_model=Optional[LinkRecord])
def search_link(url: str) -> Optional[dict]:
    """Look up a previously summarized URL."""
    return get_link_by_url(url)
