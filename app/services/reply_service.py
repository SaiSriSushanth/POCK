import json
from ..core.llm_service import client


def generate_draft_reply(
    message_text: str,
    label: str,
    reasoning: str,
    history: list[dict],
) -> str:
    """
    Generate a professional draft reply using GPT-4o-mini.

    :param message_text: The latest incoming message text.
    :param label: The predicted classification label.
    :param reasoning: The LLM's reasoning for the classification.
    :param history: Up to the last 5 messages as [{"role": "user"|"assistant", "content": "..."}].
    :return: A draft reply string.
    """
    history_text = ""
    if history:
        lines = []
        for h in history[-5:]:
            role = "Customer" if h.get("role") == "user" else "Agent"
            lines.append(f"{role}: {h.get('content', '')}")
        history_text = "\n".join(lines)

    history_section = f"\n\nConversation history (last {len(history[-5:])} messages):\n{history_text}" if history_text else ""

    prompt = f"""You are a professional customer support agent. Based on the incoming message and its AI classification, write a helpful and polite draft reply.

Classification: {label}
Reasoning: {reasoning}{history_section}

Latest customer message:
"{message_text}"

Write a concise, professional draft reply. Do not include any JSON, just the reply text itself."""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a professional customer support agent. Write helpful, concise, and polite replies.",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=300,
    )

    return response.choices[0].message.content.strip()
