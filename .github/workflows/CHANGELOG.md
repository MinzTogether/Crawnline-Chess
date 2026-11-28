# Changelog

## v3.0.2

- Simplified push notifications to show only file paths grouped as ADDED, MODIFIED and DELETED.
- Removed commit messages, commit SHAs, aggregate change counts and source-code diff previews from push notifications.
- Classified renamed files as MODIFIED and displayed the old and new paths.
- Added a permanent Crawnline Chess Releases link as the final field of all notifier messages, including fallback notifications.
- Kept success-only notification gating for `main` pushes and successful `Build & Release` runs.
- Replaced the outdated failure-notification regression test with success-only and file-list formatting tests.
- All 16 local notifier unit tests pass.

## v3.0.1

- Changed main-branch push notifications to success-only: all validation/build steps must pass.
- Suppressed main push notifications when the build job fails, is cancelled, or is skipped.
- Suppressed failed/cancelled `Build & Release` workflow notifications; release cards remain success-only.
- Added defense-in-depth success gating in the Python notifier and regression tests.

## v3.0.0

- Added Pull Request review and review-comment notifications.
- Added branch-protection-rule notifications.
- Corrected discussion activity types to the current GitHub Actions event list.
- Added Python regression tests and Discord embed validation.
- Expanded secret/path redaction and large-file guards.
- Improved webhook retry handling for HTTP 408, 425, 429, 5xx and transient network errors.
- Improved release lookup by matching the release tag to the successful workflow run commit SHA.
- Kept the existing Bun validation and build pipeline.
