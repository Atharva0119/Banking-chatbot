import unittest

from banking_nlp import normalize_text, tokenize_text
from train_model import DATA_PATH, read_examples


class TextPreparationTests(unittest.TestCase):
    def test_normalize_lowercases_and_collapses_whitespace(self):
        self.assertEqual(normalize_text("  HELLO   Bank  "), "hello bank")

    def test_tokenizer_splits_words_and_punctuation(self):
        self.assertEqual(tokenize_text("Block my ATM card!"), ["block", "my", "atm", "card", "!"])

    def test_dataset_has_multiple_examples_per_intent(self):
        questions, labels, responses = read_examples(DATA_PATH)
        self.assertEqual(len(set(labels)), 35)
        self.assertTrue(all(labels.count(tag) >= 10 for tag in set(labels)))
        self.assertTrue(all(responses[tag] for tag in set(labels)))


if __name__ == "__main__":
    unittest.main()
