# VPS outbound download test (run in VNC as root)

Paste this block first if `wget catbox` fails or returns 0 bytes.

```bash
set -e
echo "=== github.com ==="
curl -fsSIL --max-time 20 https://github.com 2>&1 | head -5 || echo FAIL
echo "=== raw.githubusercontent.com ==="
curl -fsSIL --max-time 20 https://raw.githubusercontent.com 2>&1 | head -5 || echo FAIL
echo "=== gitlab.com ==="
curl -fsSIL --max-time 20 https://gitlab.com 2>&1 | head -5 || echo FAIL
echo "=== small raw download test ==="
curl -fsSL --max-time 30 -o /tmp/gh-zip-test.zip \
  "https://codeload.github.com/git/git/zip/refs/heads/master" \
  && ls -la /tmp/gh-zip-test.zip || echo "codeload FAIL"
```

| Result | Next step |
|--------|-----------|
| GitHub/codeload OK, size > 0 | Use **git clone** (see `VNC-10MIN-PATH.md`) |
| All HTTPS fail / 0 bytes | Use **base64 chunks** (`VNC-PASTE-CHUNKS.md`) or Timeweb **recovery + chroot** |
| Only gitlab OK | Mirror repo to GitLab, `git clone` from gitlab.com |
