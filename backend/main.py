from __future__ import annotations

import json
import os
from typing import List, Optional

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


app = FastAPI(title=APP_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


@app.post("/summarize", response_model=SummaryResponse)
async def summarize(payload: SummarizeRequest) -> SummaryResponse:
    prompt = build_prompt(payload.text, payload.title, payload.url)
    return await call_gemini(prompt)
