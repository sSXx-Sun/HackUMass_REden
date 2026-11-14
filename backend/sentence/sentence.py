from nlp import get_nlp


def split_sentences(text: str) -> list[str]:
    """Split text into trimmed, non-empty sentences."""
    doc = get_nlp()(text)
    return [s.text.strip() for s in doc.sents if s.text.strip()]
