"""Text preparation and intent prediction for the BankAssist prototype."""

import re
from pathlib import Path

import joblib
from nltk.tokenize import TreebankWordTokenizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline


TOKENIZER = TreebankWordTokenizer()
# This is a deliberately conservative starting point for this small dataset.
# Revisit both values using a separate validation set as the dataset grows.
CONFIDENCE_THRESHOLD = 0.07
MIN_CONFIDENCE_MARGIN = 0.012


def normalize_text(text: str) -> str:
    """Lowercase text and standardize whitespace and common apostrophes."""
    text = text.replace("’", "'").replace("‘", "'").lower().strip()
    return re.sub(r"\s+", " ", text)


def tokenize_text(text: str) -> list[str]:
    """Split normalized text into words without needing downloaded NLTK data."""
    return TOKENIZER.tokenize(normalize_text(text))


def make_pipeline() -> Pipeline:
    """Build TF-IDF features and a Logistic Regression intent classifier."""
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    tokenizer=tokenize_text,
                    token_pattern=None,
                    lowercase=False,
                    ngram_range=(1, 2),
                    sublinear_tf=True,
                ),
            ),
            (
                "classifier",
                LogisticRegression(max_iter=1000, random_state=42),
            ),
        ]
    )


def load_model(path: str | Path = "model/intent_classifier.joblib") -> Pipeline:
    """Load the trained pipeline saved by train_model.py."""
    return joblib.load(path)


def predict_intent(text: str, model: Pipeline) -> dict[str, object]:
    """Return the most likely intent, or an explicit unknown result."""
    probabilities = model.predict_proba([text])[0]
    best_index = int(probabilities.argmax())
    confidence = float(probabilities[best_index])
    second_best = float(sorted(probabilities, reverse=True)[1])
    intent = str(model.classes_[best_index])
    margin = confidence - second_best
    if confidence < CONFIDENCE_THRESHOLD or margin < MIN_CONFIDENCE_MARGIN:
        return {
            "intent": None,
            "confidence": confidence,
            "margin": margin,
            "known": False,
        }
    return {
        "intent": intent,
        "confidence": confidence,
        "margin": margin,
        "known": True,
    }
