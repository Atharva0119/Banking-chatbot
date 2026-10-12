import unittest

from app import app


class ChatApiTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_health_endpoint(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {"status": "ok"})

    def test_homepage_includes_chat_and_styles(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        page = response.get_data(as_text=True)
        self.assertIn("What can we help with?", page)
        self.assertIn("/static/style.css", page)
        self.assertIn("/static/script.js", page)
        self.assertIn('id="theme-toggle"', page)
        self.assertIn("Dark mode", page)
        self.assertNotIn("ABOUT THE PROJECT", page)
        self.assertNotIn("Under the hood", page)
        self.assertIn("Browse common questions", page)
        self.assertNotIn("Viva mode", page)

    def test_faq_endpoint_returns_categorized_questions(self):
        response = self.client.get("/api/faqs")
        self.assertEqual(response.status_code, 200)
        result = response.get_json()["faqs"]
        self.assertEqual(len(result), 35)
        self.assertTrue(all(item["category"] for item in result))
        self.assertTrue(all(item["question"] and item["answer"] for item in result))

    def test_known_question_returns_knowledge_base_answer(self):
        response = self.client.post("/api/chat", json={"message": "How do I block my ATM card?"})
        self.assertEqual(response.status_code, 200)
        result = response.get_json()
        self.assertEqual(result["intent"], "block_card")
        self.assertIn("official", result["reply"])
        self.assertFalse(result["fallback"])

    def test_paraphrased_questions_match_banking_intents(self):
        examples = [
            ("please freeze my debit card now", "block_card"),
            ("I forgot my internet banking login password", "reset_netbanking_password"),
            ("my transfer is not going through", "failed_upi"),
        ]
        for question, expected_intent in examples:
            with self.subTest(question=question):
                response = self.client.post("/api/chat", json={"message": question})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.get_json()["intent"], expected_intent)

    def test_malformed_json_is_rejected(self):
        response = self.client.post(
            "/api/chat", data="{not valid json", content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_unknown_question_returns_safe_fallback(self):
        response = self.client.post("/api/chat", json={"message": "What is the weather tomorrow?"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.get_json()["fallback"])

    def test_missing_or_empty_message_is_rejected(self):
        self.assertEqual(self.client.post("/api/chat", json={}).status_code, 400)
        self.assertEqual(self.client.post("/api/chat", json={"message": "  "}).status_code, 400)

    def test_sensitive_input_is_not_processed(self):
        response = self.client.post("/api/chat", json={"message": "My PIN is 1234"})
        self.assertEqual(response.status_code, 400)
        self.assertIn("don't enter", response.get_json()["reply"])

    def test_long_message_is_rejected(self):
        response = self.client.post("/api/chat", json={"message": "a" * 1001})
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main()
