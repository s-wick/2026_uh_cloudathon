---
description: Copy the temporary lab credentials from .env into the hackathon AWS CLI profile and verify them
---

Refresh the `hackathon` AWS CLI profile from `.env` without printing any secret values.

Run this with the Bash tool from the repo root:

```bash
set -a && . <(tr -d '\r' < .env) && set +a
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID" --profile hackathon
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY" --profile hackathon
aws configure set aws_session_token "$AWS_SESSION_TOKEN" --profile hackathon
[ -n "$AWS_DEFAULT_REGION" ] && aws configure set region "$AWS_DEFAULT_REGION" --profile hackathon
aws sts get-caller-identity --profile hackathon
```

Report only whether the identity check succeeded and the role ARN. If it fails with `ExpiredToken`, tell the user to paste fresh credentials into `.env` from the labs page, then run this again.
