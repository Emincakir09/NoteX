import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

print("🔍 BU SÜRÜMDE GEÇERLİ OLAN MODELLER:")
print("-" * 40)

try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            # Sadece ismini yazdıralım ki kopyalaması kolay olsun
            print(m.name.replace("models/", ""))
except Exception as e:
    print(f"Hata: {e}")