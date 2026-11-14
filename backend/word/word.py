from nlp import get_nlp


def analyze_word(word: str) -> dict | None:
    """Return basic linguistic info for a single word, or None if empty."""
    doc = get_nlp()(word.strip())
    if not len(doc):
        return None
    t = doc[0]
    return {
        "word": t.text,
        "lemma": t.lemma_,
        "pos": t.pos_,
        "is_stop": t.is_stop,
        "is_alpha": t.is_alpha,
    }
