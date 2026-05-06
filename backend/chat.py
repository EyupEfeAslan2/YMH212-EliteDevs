import re
from typing import Optional
import google.genai as genai
from config import get_gemini_api_key

GEMINI_MODEL = "gemini-2.5-flash" 
#GEMINI_MODEL = "gemini-2.0-flash-lite"

def get_gemini_client():
    """Get configured Gemini client."""
    api_key = get_gemini_api_key()
    return genai.Client(api_key=api_key)

class ContractChatSession:

    def __init__(self, contract_text: str, contract_summary: Optional[dict] = None):
        self.contract_text = contract_text
        self.contract_summary = contract_summary or {}
        self.client = get_gemini_client()
        self.chat_history = []
        self._build_system_instruction()
    
    def _build_system_instruction(self):
        """Build system instruction for the chat."""
        self.system_instruction = f"""
SYSTEM ROLE:
You are an elite Legal Tech AI Assistant specializing in privacy agreements.

--- DOCUMENT TO ANALYZE ---
{self.contract_text[:5000]}...

--- PREVIOUS ANALYSIS ---
{self.contract_summary}

STRICT OUTPUT RULES (NON-NEGOTIABLE):
1. NO HEADERS: Never use 'Recommendation:', 'veri_silme_durumu:', 'Answer:', 'Cevap:' or any text followed by a colon (:).
2. NO JSON/SYMBOLS: Never use {{}}, [], or parentheses ().
3. LANGUAGE MATCH: You MUST detect the user's language and respond in THAT SAME LANGUAGE. If asked in Turkish, answer in Turkish. If asked in English, answer in English.
4. PURE TEXT ONLY: Start your sentence directly with the answer.
   - BAD: "Cevap: Verileriniz silinmez."
   - GOOD: "Verileriniz silinmez."
5. SCOPE: Only talk about the contract. Otherwise say: "I can only answer questions about this contract."
6. TRUTH: If not in text, say "This information is not provided in the contract text."
7. Max 3 sentences. No legal advice.
"""
    
    def ask(self, user_query: str) -> str:
        try:
            # Build messages with system instruction
            messages = [
                {
                    "role": "user",
                    "parts": [self.system_instruction]
                },
                {
                    "role": "user",
                    "parts": [user_query]
                }
            ]
            
            response = self.client.models.generate_content(
                model=GEMINI_MODEL,
                contents=messages,
                config={
                    "temperature": 0.7,
                    "max_output_tokens": 500,
                }
            )
            
            text = response.text
            
            # Clean up response
            cleaned_text = re.sub(r'[\[\]{}()"]', '', text)
            cleaned_text = cleaned_text.strip()
            
            return cleaned_text
        
        except Exception as e:
            return f"Error processing your question: {str(e)}"


def create_chat_session(contract_text: str, summary: Optional[dict] = None) -> ContractChatSession:
    return ContractChatSession(contract_text, summary)


def build_chat_prompt(user_query: str, contract_context: str) -> str:

    return f"""
Based on this contract section:
{contract_context}

User Question: {user_query}

Provide a concise, clear answer in the same language as the question.
"""


def extract_relevant_section(contract_text: str, keywords: list) -> str:

    lines = contract_text.split('\n')
    relevant_lines = []
    
    for line in lines:
        if any(keyword.lower() in line.lower() for keyword in keywords):
            relevant_lines.append(line)
    
    return '\n'.join(relevant_lines[:5])  #Limit to 5 relevant lines

COMMON_QUESTIONS = {
    "data_deletion": "Hesabımı sildikten sonra verilerim hemen siliniyor mu?",
    "data_sharing": "Verilerim üçüncü taraflarla paylaşılıyor mu?",
    "payment": "Ücretlendirme nasıl yapılıyor?",
    "cookies": "Çerezleri nasıl yönetebilirim?",
    "gdpr": "GDPR hakkında ne deniyor?",
}

def get_quick_answer(question_type: str, session: ContractChatSession) -> Optional[str]:

    if question_type in COMMON_QUESTIONS:
        return session.ask(COMMON_QUESTIONS[question_type])
    
    return None
