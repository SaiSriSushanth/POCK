from sqlalchemy.orm import Session
from .llm_service import get_embedding, classify_with_llm
from .vector_service import get_top_labels
from ..models import Message, Classification
from ..utils.normalization import NormalizedMessage

def process_normalized_message(db: Session, msg: NormalizedMessage):
    # 1. Store Message
    db_message = Message(
        source=msg.source,
        sender_id=msg.sender_id,
        message_text=msg.text
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)

    # 2. Generate Embedding
    message_embedding = get_embedding(msg.text)

    # 3. Vector Search
    top_labels = get_top_labels(db, message_embedding)
    
    best_vector_match = top_labels[0] if top_labels else {"similarity": 0}
    embedding_score = best_vector_match.get("similarity", 0)

    # 4. LLM Reasoning
    llm_result = classify_with_llm(msg.text, top_labels)
    
    # 5. Hybrid Confidence
    llm_confidence = llm_result.get("confidence", 0)
    final_confidence = (0.4 * embedding_score) + (0.6 * llm_confidence)
    
    # DEBUG: Print raw scores
    print(f"DEBUG Scores -> Vector: {embedding_score:.4f}, LLM: {llm_confidence:.4f}, Final: {final_confidence:.4f}")
    
    predicted_label = llm_result.get("label", "Unclassified")
    if final_confidence < 0.5:
        predicted_label = f"Needs Review ({predicted_label})"

    # 6. Store Result
    classification = Classification(
        message_id=db_message.id,
        predicted_label=predicted_label,
        embedding_score=embedding_score,
        llm_confidence=llm_confidence,
        final_confidence=final_confidence,
        reasoning=llm_result.get("reason", "")
    )
    db.add(classification)
    db.commit()
    db.refresh(classification)

    # Log Output
    print(f"\n--------- Classification ---------")
    print(f"Message: \"{msg.text}\"")
    print(f"Source: {msg.source.upper()}")
    print(f"Predicted: {predicted_label}")
    print(f"Confidence: {final_confidence:.2f}")
    print(f"Reason: {classification.reasoning}")
    print(f"------------------------------------\n")

    return classification
