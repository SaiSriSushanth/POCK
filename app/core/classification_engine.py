from sqlalchemy.orm import Session
from .llm_service import get_embedding, classify_with_llm
from .vector_service import get_top_labels
from ..models import Message, Classification
from ..utils.normalization import NormalizedMessage
from typing import Optional
from uuid import UUID


def process_normalized_message(
    db: Session,
    msg: NormalizedMessage,
    business_id: Optional[UUID] = None,
    conversation_id: Optional[UUID] = None,
):
    # Resolve business_id — prefer explicit arg, fall back to msg field
    biz_id = business_id or msg.business_id

    # 1. Store Message
    db_message = Message(
        business_id=biz_id,
        conversation_id=conversation_id,
        source=msg.source,
        sender_id=msg.sender_id,
        message_text=msg.text,
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # 2. Generate Embedding
    message_embedding = get_embedding(msg.text)

    # 3. Vector Search (scoped to business labels, with global fallback)
    top_labels = get_top_labels(db, message_embedding, business_id=biz_id)

    best_vector_match = top_labels[0] if top_labels else {"similarity": 0}
    embedding_score = best_vector_match.get("similarity", 0)

    # 4. LLM Reasoning
    llm_result = classify_with_llm(msg.text, top_labels)

    # 5. Hybrid Confidence
    llm_confidence = llm_result.get("confidence", 0)
    final_confidence = (0.4 * embedding_score) + (0.6 * llm_confidence)

    print(f"DEBUG Scores -> Vector: {embedding_score:.4f}, LLM: {llm_confidence:.4f}, Final: {final_confidence:.4f}")

    predicted_label = llm_result.get("label", "Unclassified")
    if final_confidence < 0.5:
        predicted_label = f"Needs Review ({predicted_label})"

    # 6. Store Result
    classification = Classification(
        business_id=biz_id,
        message_id=db_message.id,
        predicted_label=predicted_label,
        embedding_score=embedding_score,
        llm_confidence=llm_confidence,
        final_confidence=final_confidence,
        reasoning=llm_result.get("reason", ""),
    )
    db.add(classification)
    db.commit()
    db.refresh(classification)

    print(f"\n--------- Classification ---------")
    print(f"Message: \"{msg.text}\"")
    print(f"Source: {msg.source.upper()}")
    print(f"Business: {biz_id}")
    print(f"Predicted: {predicted_label}")
    print(f"Confidence: {final_confidence:.2f}")
    print(f"Reason: {classification.reasoning}")
    print(f"------------------------------------\n")

    return classification
