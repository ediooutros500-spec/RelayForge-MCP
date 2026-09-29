# Security Policy

RelayForge MCP can read/write files and execute local processes. Treat access to its MCP endpoint as privileged access to the host computer.

## Reporting a vulnerability

Please open a GitHub security advisory or a private report in the repository. Do not publish credentials, tokens, private URLs, or proof-of-concept data containing personal files in a public issue.

## Deployment guidance

- Bind to `127.0.0.1` by default.
- Use HTTPS for remote access.
- Use `RELAYFORGE_HTTP_TOKEN` on public endpoints.
- Keep `.env` and tunnel credentials out of version control.
- Restrict `allowedDirectories` when possible.
- Rotate any secret that is accidentally exposed.
