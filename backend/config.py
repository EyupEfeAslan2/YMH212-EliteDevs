import os
from dotenv import load_dotenv

load_dotenv()

_gemini_api_key = None
_api_key_initialized = False
_selected_api = None

def select_api():
    """Let user select which API to use."""
    global _selected_api
    
    print("\n" + "="*50)
    print("API Seçimi")
    print("="*50)
    print("1. Gemini (Google)")
    print("2. OpenAI (ChatGPT)")
    print("3. Claude (Anthropic)")
    
    choice = input("\nHangi API kullanacaksınız? (1-3): ").strip()
    
    api_options = {
        "1": "gemini",
        "2": "openai",
        "3": "claude"
    }
    
    _selected_api = api_options.get(choice, "gemini")
    return _selected_api

def get_gemini_api_key() -> str:
    global _gemini_api_key, _api_key_initialized
    
    if _api_key_initialized:
        if not _gemini_api_key:
            raise ValueError("Gemini API anahtarı girilmedi!")
        return _gemini_api_key
    
    _gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    if not _gemini_api_key:
        try:
            api = select_api()
            if api == "gemini":
                _gemini_api_key = input("Lütfen Gemini API anahtarınızı girin: ").strip()
            elif api == "openai":
                _gemini_api_key = input("Lütfen OpenAI API anahtarınızı girin: ").strip()
            elif api == "claude":
                _gemini_api_key = input("Lütfen Claude API anahtarınızı girin: ").strip()
        except EOFError:
            raise ValueError("API anahtarı girilmedi ve ortam değişkeni de bulunmadı!")
    
    if not _gemini_api_key:
        raise ValueError("API anahtarı boş olamaz!")
    
    _api_key_initialized = True
    return _gemini_api_key

def set_gemini_api_key(api_key: str) -> None:

    global _gemini_api_key, _api_key_initialized
    
    if not api_key or not api_key.strip():
        raise ValueError("API anahtarı boş olamaz!")
    
    _gemini_api_key = api_key.strip()
    _api_key_initialized = True

def is_api_key_initialized() -> bool: #Check if API key has been initialized
    return _api_key_initialized

def get_selected_api() -> str:
    """Get selected API type."""
    return _selected_api or "gemini"

