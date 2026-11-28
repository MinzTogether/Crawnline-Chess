"""Dependency-free regression tests for Crawn's Discord notifier."""

from __future__ import annotations

import importlib.util
import io
import json
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

SCRIPT = Path(__file__).resolve().parents[1] / "discord_notify.py"
SPEC = importlib.util.spec_from_file_location("crawn_discord_notify", SCRIPT)
notifier = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(notifier)


class RedactionTests(unittest.TestCase):
    def test_common_tokens_are_redacted(self):
        samples = [
            "ghp_" + "A" * 36,
            "github_pat_" + "B" * 40,
            "glpat-" + "C" * 30,
            "xoxb-" + "D" * 24,
            "AIza" + "E" * 35,
            "sk_live_" + "F" * 24,
        ]
        for secret in samples:
            with self.subTest(secret=secret[:8]):
                self.assertNotIn(secret, notifier.redact(secret))

    def test_assignment_secrets_are_redacted(self):
        value = '"api_key": "super-secret-value"'
        self.assertNotIn("super-secret-value", notifier.redact(value))

    def test_sensitive_paths_are_hidden(self):
        paths = [
            ".env",
            ".env.production",
            ".ssh/id_ed25519",
            ".aws/credentials",
            ".docker/config.json",
            "android/release.keystore",
            "certs/signing.p12",
            "config/service-account.json",
        ]
        for path in paths:
            with self.subTest(path=path):
                self.assertTrue(notifier.is_sensitive_path(path))

    def test_lock_and_generated_files_are_classified_as_noisy(self):
        for path in ("bun.lock", "bun.lockb", "package-lock.json", "dist/app.min.js", "assets/app.js.map"):
            with self.subTest(path=path):
                self.assertRegex(path, notifier._NOISY_PATH)


class PayloadTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "GITHUB_REPOSITORY": "example/Crawn",
            "GITHUB_SERVER_URL": "https://github.com",
            "GITHUB_ACTOR": "tester",
            "GITHUB_RUN_ID": "12345",
        }

    def assert_safe_payload(self, payload):
        self.assertEqual(payload["allowed_mentions"], {"parse": []})
        notifier.validate_payload(payload)
        self.assertLessEqual(len(payload["embeds"]), 10)

    def test_review_payload(self):
        event = {
            "action": "submitted",
            "sender": {"login": "reviewer"},
            "pull_request": {"number": 12, "title": "Improve board", "html_url": "https://github.com/example/Crawn/pull/12"},
            "review": {
                "state": "approved",
                "user": {"login": "reviewer"},
                "body": "Looks good",
                "html_url": "https://github.com/example/Crawn/pull/12#pullrequestreview-1",
                "commit_id": "a" * 40,
            },
        }
        payload = notifier.build_payload("pull_request_review", event, self.env)
        self.assert_safe_payload(payload)
        embed = payload["embeds"][0]
        self.assertIn("Pull Request Review", embed["title"])
        self.assertTrue(any(field["name"] == "Review State" and field["value"] == "Approved" for field in embed["fields"]))

    def test_review_comment_payload(self):
        event = {
            "action": "created",
            "sender": {"login": "reviewer"},
            "pull_request": {"number": 8, "title": "Improve parser", "html_url": "https://github.com/example/Crawn/pull/8"},
            "comment": {
                "user": {"login": "reviewer"},
                "path": "src/parser.ts",
                "line": 44,
                "body": "Please handle this edge case.",
                "html_url": "https://github.com/example/Crawn/pull/8#discussion_r1",
            },
        }
        payload = notifier.build_payload("pull_request_review_comment", event, self.env)
        self.assert_safe_payload(payload)
        values = "\n".join(field["value"] for field in payload["embeds"][0]["fields"])
        self.assertIn("src/parser.ts", values)
        self.assertIn("Please handle this edge case.", values)

    def test_branch_protection_payload(self):
        event = {
            "action": "created",
            "sender": {"login": "maintainer"},
            "rule": {
                "name": "main",
                "enforcement": "active",
                "required_status_checks": {"contexts": ["build", "test"]},
            },
        }
        payload = notifier.build_payload("branch_protection_rule", event, self.env)
        self.assert_safe_payload(payload)
        fields = payload["embeds"][0]["fields"]
        self.assertTrue(any(field["name"] == "Required Status Checks" and "build" in field["value"] for field in fields))

    def test_pull_request_target_uses_pull_request_handler(self):
        event = {
            "action": "opened",
            "sender": {"login": "contributor"},
            "pull_request": {
                "number": 5,
                "title": "A new PR",
                "state": "open",
                "html_url": "https://github.com/example/Crawn/pull/5",
            },
        }
        payload = notifier.build_payload("pull_request_target", event, self.env)
        self.assert_safe_payload(payload)
        self.assertIn("Pull Request Activity", payload["embeds"][0]["title"])

    def test_main_push_is_suppressed_when_build_did_not_succeed(self):
        event = {
            "ref": "refs/heads/main",
            "created": False,
            "deleted": False,
        }
        for result in ("failure", "cancelled", "skipped", "unknown", ""):
            with self.subTest(result=result):
                env = dict(self.env, CRAWN_BUILD_RESULT=result)
                reason = notifier.skip_reason("push", event, env)
                self.assertIn("successful validation/build is required", reason)

    def test_main_push_is_allowed_only_after_successful_build(self):
        event = {
            "ref": "refs/heads/main",
            "created": False,
            "deleted": False,
        }
        env = dict(self.env, CRAWN_BUILD_RESULT="success")
        self.assertIsNone(notifier.skip_reason("push", event, env))

    def test_main_push_success_payload_marks_build_success(self):
        env = dict(self.env, CRAWN_BUILD_RESULT="success", GITHUB_SHA="a" * 40)
        event = {
            "ref": "refs/heads/main",
            "before": "a" * 40,
            "after": "b" * 40,
            "created": False,
            "deleted": False,
            "commits": [{"id": "b" * 40, "message": "test commit", "url": "https://github.com/example/Crawn/commit/" + "b" * 40}],
            "head_commit": {"id": "b" * 40, "message": "test commit", "url": "https://github.com/example/Crawn/commit/" + "b" * 40},
            "sender": {"login": "tester"},
        }
        with patch.object(notifier, "resolve_range", return_value=("none", "", "b" * 40)), \
             patch.object(notifier, "list_changes", return_value=[]), \
             patch.object(notifier, "count_commits", return_value=1):
            payload = notifier.build_payload("push", event, env)
        self.assert_safe_payload(payload)
        embed = payload["embeds"][0]
        self.assertEqual(embed["color"], notifier.GREEN)
        self.assertTrue(any(field["name"] == "Main Build" and field["value"] == "Success" for field in embed["fields"]))

    def test_build_release_failures_are_silent(self):
        for conclusion in ("failure", "cancelled", "timed_out", "action_required"):
            with self.subTest(conclusion=conclusion):
                event = {"workflow_run": {"name": "Build & Release", "conclusion": conclusion}}
                reason = notifier.skip_reason("workflow_run", event, self.env)
                self.assertIn("failure notifications are disabled", reason)

    def test_no_mentions_are_allowed_in_any_event(self):
        event = {"action": "started", "sender": {"login": "user"}}
        payload = notifier.build_payload("watch", event, self.env)
        self.assertEqual(payload["allowed_mentions"], {"parse": []})

    def test_issue_shaped_pr_event_is_skipped(self):
        event = {"issue": {"pull_request": {"url": "https://api.github.com/..."}}}
        reason = notifier.skip_reason("issues", event, self.env)
        self.assertIn("pull_request", reason)

    def test_successful_build_release_uses_dedicated_release_card(self):
        event = {"workflow_run": {"name": "Build & Release", "conclusion": "success"}}
        self.assertIsNotNone(notifier.skip_reason("workflow_run", event, self.env))

    def test_created_push_is_suppressed_to_avoid_duplicate_ref_notice(self):
        event = {"created": True, "ref": "refs/heads/feature"}
        self.assertIsNotNone(notifier.skip_reason("push", event, self.env))


class DeliveryTests(unittest.TestCase):
    def test_webhook_validation(self):
        self.assertRegex(
            "https://discord.com/api/webhooks/123456/token_value",
            notifier.WEBHOOK_RE,
        )
        self.assertNotRegex("https://example.com/webhook", notifier.WEBHOOK_RE)

    def test_retry_after_rate_limit_then_success(self):
        headers = Message()
        headers["Content-Type"] = "application/json"
        error = HTTPError(
            "https://discord.com/api/webhooks/123/token",
            429,
            "rate limited",
            headers,
            io.BytesIO(b'{"retry_after": 0.01}'),
        )
        response = unittest.mock.MagicMock()
        response.__enter__.return_value.status = 204
        payload = {"content": "test", "allowed_mentions": {"parse": []}}
        env = {"GITHUB_SERVER_URL": "https://github.com", "GITHUB_REPOSITORY": "example/Crawn"}
        with patch.object(notifier.urllib.request, "urlopen", side_effect=[error, response]), \
             patch.object(notifier.time, "sleep") as sleep:
            status = notifier.post_webhook(
                "https://discord.com/api/webhooks/123/token", payload, env, attempts=2
            )
        self.assertEqual(status, 204)
        sleep.assert_called_once()


if __name__ == "__main__":
    unittest.main(verbosity=2)
