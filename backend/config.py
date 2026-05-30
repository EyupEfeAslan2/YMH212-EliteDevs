import os
from dotenv import load_dotenv

load_dotenv()

_api_key = None
_api_key_initialized = False


def get_gemini_api_key() -> str:
    """Get the Gemini API key. Checks memory first, then env var."""
    global _api_key, _api_key_initialized
    
    if _api_key_initialized and _api_key:
        return _api_key
    
    # Try environment variable
    env_key = os.getenv("GEMINI_API_KEY")
    if env_key and env_key.strip() and env_key != "your-gemini-api-key-here":
        _api_key = env_key.strip()
        _api_key_initialized = True
        return _api_key
    
    raise ValueError(
        "API anahtarı ayarlanmamış! "
        "Lütfen eklenti ayarlarından Gemini API anahtarınızı girin "
        "veya .env dosyasına GEMINI_API_KEY ekleyin."
    )


def set_gemini_api_key(api_key: str) -> None:
    """Set the Gemini API key from frontend."""
    global _api_key, _api_key_initialized
    
    if not api_key or not api_key.strip():
        raise ValueError("API anahtarı boş olamaz!")
    
    _api_key = api_key.strip()
    _api_key_initialized = True


def is_api_key_initialized() -> bool:
    """Check if API key has been initialized."""
    # Also check env var on first call
    if not _api_key_initialized:
        try:
            get_gemini_api_key()
            return True
        except ValueError:
            return False
    return _api_key_initialized
