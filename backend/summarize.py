import json
from typing import Optional, Any
import google.genai as genai
from config import get_gemini_api_key

GEMINI_MODEL = "gemini-2.5-flash"

def get_gemini_client():
    """Get configured Gemini client."""
    api_key = get_gemini_api_key()
    return genai.Client(api_key=api_key)

def get_summarizer_model():
    """Create summarizer model with JSON response."""
    client = get_gemini_client()
    return client

# Prompt
def build_summarization_prompt(text: str) -> str:  
    prompt = f"""
Act as a legal expert specialized in digital privacy. Your goal is to simplify this agreement into a VERY CONCISE, easy-to-read summary for a browser extension.

STRICT CONSTRAINTS:
1. DETECT the language of the provided text.
2. Provide all content for 'overall_summary', 'key_finding', 'text', and 'reason' in the SAME LANGUAGE as the original text.
3. Keep the JSON KEYS in English (as defined below).
4. CONCISENESS: Summarize each point into MAX 15 words. Group related clauses.
5. Provide a maximum of 15 segments in total for 'analysis_segments'.
6. Output ONLY raw JSON.

JSON STRUCTURE:
{{
  "summary_stats": {{
    "risk_score": An integer between 1-10.
                CALIBRATION:
                - Standard, legally required data collection (name, email) = 1-3.
                - Marketing tracking or 3rd party sharing for service = 4-6.
                - Selling data to advertisers, no deletion rights, or total liability waiver = 7-10.
                Be realistic; do not give high scores just for standard legal language.,
    "overall_summary": "A high-level summary of the entire agreement in max 3 sentences.",
    "critical_highlight": "The single most important clause the user must be aware of."
  }},
  "analysis_segments": [
    {{
      "id": 1,
      "text": "Summary of the legal point (max 15 words)",
      "risk_level": "red/yellow/green",
      "reason": "Brief explanation for the risk color (max 10 words)."
    }}
  ]
}}

TEXT TO ANALYZE:
{text}
"""
    return prompt

# Json Cleaning
def clean_json_response(raw_text: str) -> Optional[dict]:
    clean_text = raw_text.replace('```json', '').replace('```', '').strip()
    try:
        return json.loads(clean_text)
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {e}")
        return None


def summarize_text(text: str) -> dict:
    try:
        client = get_gemini_client()
        prompt = build_summarization_prompt(text)
        
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "temperature": 1.0,
                "max_output_tokens": 2000,
            }
        )
        
        result = clean_json_response(response.text)
        if result is None:
            return {
                "error": True,
                "message": "Failed to parse API response as JSON",
                "raw_response": response.text[:500]
            }
        
        return {"error": False, **result}
    
    except Exception as e:
        return {
            "error": True,
            "message": f"Error during summarization: {str(e)}"
        }


def get_summary_stats(summary_result: dict) -> dict:
    if summary_result.get("error"):
        return {
            "risk_score": 0,
            "overall_summary": summary_result.get("message", "Error"),
            "critical_highlight": "Error occurred"
        }
    
    return summary_result.get("summary_stats", {})


def get_analysis_segments(summary_result: dict) -> list:

    if summary_result.get("error"):
        return []
    
    return summary_result.get("analysis_segments", [])
