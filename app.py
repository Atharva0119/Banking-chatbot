"""Flask API for the BankAssist academic chatbot prototype."""

import json
import os
import re
from pathlib import Path

import joblib
from flask import Flask, jsonify, render_template, request

from banking_nlp import make_pipeline, predict_intent
from train_model import read_examples


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_PATH = BASE_DIR / "intents.json"
DEFAULT_MODEL_PATH = BASE_DIR / "model" / "intent_classifier.joblib"
MAX_MESSAGE_LENGTH = 1000

# Reject obvious credential-shaped input before passing a message to the model.
LABELED_SECRET = re.compile(
    r"\b(?:otp|pin|cvv|cvc|password|passcode)\s*(?::|=|\bis\b)\s*[A-Za-z0-9-]{3,}",
    re.IGNORECASE,
)
CARD_NUMBER = re.compile(r"(?<!\d)(?:\d[ -]?){12,19}(?!\d)")
STANDALONE_CODE = re.compile(r"^\d{4,8}$")

SAFE_INPUT_REPLY = (
    "For your safety, don't enter OTPs, PINs, CVVs, passwords, or full card numbers. "
    "Please remove that information and ask your question again."
)
FALLBACK_REPLY = (
    "I'm not sure I understood that banking question. Please rephrase it, or contact "
    "your bank through its official app, website, or phone number for account-specific help."
)


def load_knowledge_base(path: Path) -> dict[str, list[str]]:
    """Read answer text from JSON and index it by intent tag."""
    content = json.loads(path.read_text(encoding="utf-8"))
    return {item["tag"]: item["responses"] for item in content["intents"]}


def load_faqs(path: Path) -> list[dict[str, str]]:
    """Create one browseable FAQ card for each intent in the dataset."""
    content = json.loads(path.read_text(encoding="utf-8"))
    return [
        {
            "tag": item["tag"],
            "category": item.get("category", "Other"),
            "question": item["patterns"][0],
            "answer": item["responses"][0],
        }
        for item in content["intents"]
        if item.get("patterns") and item.get("responses")
    ]


def load_or_train_model(model_path: Path, data_path: Path):
    """Load the generated model, or create it from the dataset if absent."""
    if model_path.exists():
        return joblib.load(model_path)

    questions, labels, _ = read_examples(data_path)
    model = make_pipeline()
    model.fit(questions, labels)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, model_path)
    return model


def contains_sensitive_value(message: str) -> bool:
    """Detect common credential formats without storing the submitted text."""
    compact_digits = re.sub(r"[ -]", "", message)
    return bool(
        LABELED_SECRET.search(message)
        or CARD_NUMBER.search(message)
        or STANDALONE_CODE.fullmatch(compact_digits.strip())
    )


def create_app(
    model_path: Path = DEFAULT_MODEL_PATH,
    data_path: Path = DEFAULT_DATA_PATH,
) -> Flask:
    """Create the web app; separate inputs make API behavior easy to test."""
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 16 * 1024
    app.config["TEMPLATES_AUTO_RELOAD"] = True

    try:
        model = load_or_train_model(model_path, data_path)
        knowledge_base = load_knowledge_base(data_path)
        faq_items = load_faqs(data_path)
    except Exception as exc:
        # Keep detail in the process log for local debugging; never return it to
        # the browser. This message does not contain the user's submitted text.
        app.logger.error("Could not initialize BankAssist: %s", type(exc).__name__)
        raise RuntimeError("BankAssist could not initialize its local data or model.") from exc

    @app.get("/")
    def home():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok"})

    @app.get("/api/faqs")
    def faqs():
        return jsonify({"faqs": faq_items})

    @app.post("/api/chat")
    def chat():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("message"), str):
            return jsonify({"error": "Send a JSON object with a text message."}), 400

        message = payload["message"].strip()
        if not message:
            return jsonify({"error": "Please enter a question."}), 400
        if len(message) > MAX_MESSAGE_LENGTH:
            return jsonify({"error": "The question is too long. Please keep it under 1000 characters."}), 400
        if contains_sensitive_value(message):
            return jsonify({"reply": SAFE_INPUT_REPLY, "fallback": True}), 400

        result = predict_intent(message, model)
        tag = result["intent"]
        if not result["known"] or tag not in knowledge_base:
            return jsonify({"reply": FALLBACK_REPLY, "fallback": True}), 200

        answer = knowledge_base[tag][0]
        response = {
            "reply": answer,
            "intent": tag,
            "confidence": round(float(result["confidence"]), 3),
            "fallback": False,
        }
        return jsonify(response)

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({"error": "Request is too large."}), 413

    @app.errorhandler(500)
    def server_error(_error):
        return jsonify({"error": "The chatbot encountered a problem. Please try again."}), 500

    return app


app = create_app()


if __name__ == "__main__":
    # macOS services sometimes reserve port 5000. PORT can override this for
    # deployment or when a different local port is needed.
    app.run(debug=False, port=int(os.environ.get("PORT", "5001")))
