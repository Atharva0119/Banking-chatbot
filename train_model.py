"""Train and evaluate BankAssist's intent classifier on held-out examples."""

import json
from pathlib import Path

import joblib
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.model_selection import train_test_split

from banking_nlp import make_pipeline, predict_intent


DATA_PATH = Path("intents.json")
MODEL_PATH = Path("model/intent_classifier.joblib")
RANDOM_SEED = 42
TEST_SIZE = 0.20


def read_examples(path: Path) -> tuple[list[str], list[str], dict[str, list[str]]]:
    """Read example questions and keep response text indexed by intent tag."""
    data = json.loads(path.read_text(encoding="utf-8"))
    questions: list[str] = []
    labels: list[str] = []
    responses: dict[str, list[str]] = {}

    for item in data["intents"]:
        tag = item["tag"]
        responses[tag] = item["responses"]
        for question in item["patterns"]:
            questions.append(question)
            labels.append(tag)

    if not questions:
        raise ValueError("The intent dataset contains no example questions.")
    return questions, labels, responses


def main() -> None:
    questions, labels, _ = read_examples(DATA_PATH)
    x_train, x_test, y_train, y_test = train_test_split(
        questions,
        labels,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=labels,
    )

    model = make_pipeline()
    model.fit(x_train, y_train)
    predictions = model.predict(x_test)
    label_names = sorted(set(labels))

    accuracy = accuracy_score(y_test, predictions)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, predictions, average="macro", zero_division=0
    )
    print(f"Dataset: {len(questions)} examples across {len(label_names)} intents")
    print(f"Split: {len(x_train)} training, {len(x_test)} held-out test examples")
    print(f"Accuracy: {accuracy:.3f}")
    print(f"Macro precision: {precision:.3f}")
    print(f"Macro recall: {recall:.3f}")
    print(f"Macro F1-score: {f1:.3f}")
    print("\nPer-intent report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=label_names,
            target_names=label_names,
            zero_division=0,
        )
    )
    matrix = confusion_matrix(y_test, predictions, labels=label_names)
    print("Confusion matrix (rows=true labels, columns=predicted labels):")
    print("Labels:", ", ".join(label_names))
    print(matrix)

    # Keep the held-out examples out of the score above. After evaluation,
    # refit on all labeled examples so the saved application model can learn
    # from the complete starter dataset.
    model = make_pipeline()
    model.fit(questions, labels)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\nSaved trained model to {MODEL_PATH}")

    sample_questions = [
        "I lost my ATM card and need it blocked",
        "My UPI transfer failed but the money left my account",
        "How do I get a new internet banking password?",
        "Can you tell me my account balance?",
        "What is the weather tomorrow?",
    ]
    print("\nSample predictions (not part of evaluation):")
    for question in sample_questions:
        result = predict_intent(question, model)
        print(
            f"- {question!r} -> {result['intent'] or 'unknown'} "
            f"(confidence {result['confidence']:.3f})"
        )


if __name__ == "__main__":
    main()
