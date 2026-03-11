import os
import json
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text: str):
    """Generates embedding for the given text using text-embedding-3-small."""
    text = text.replace("\n", " ")
    response = client.embeddings.create(
        input=[text],
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

def classify_with_llm(message_text: str, top_labels: list):
    """Classifies message using GPT-4o-mini based on top similar labels."""
    labels_desc = "\n".join([f"{i+1}. {l['name']} - {l['description']}" for i, l in enumerate(top_labels)])
    
    prompt = f"""You are a lead classification AI.

Available labels:
{labels_desc}

Classify the following message into exactly one label from the list above.

Return strict JSON:
{{
  "label": "",
  "confidence": 0-1,
  "reason": ""
}}

Message:
"{message_text}"
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that classifies leads."},
            {"role": "user", "content": prompt}
        ],
        temperature=0,
        response_format={"type": "json_object"}
    )
    
    return json.loads(response.choices[0].message.content)
