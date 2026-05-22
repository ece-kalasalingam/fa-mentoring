# Security Policy

## Supported Versions

Use this table to show which versions currently receive security updates.

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| older   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it privately.

- Do not open a public GitHub issue for suspected vulnerabilities.
- Preferred channel: GitHub Private Vulnerability Reporting (Security tab)
- Fallback email: `security@eceklu.in`
- Include:
  - A clear description of the issue
  - Steps to reproduce
  - Affected components/files
  - Potential impact
  - Any suggested remediation

## What to Expect

- Initial acknowledgement: within 3 business days
- Triage/update: within 7 business days
- Remediation timeline depends on severity and complexity

We will keep you informed throughout triage and remediation, and coordinate a responsible disclosure timeline once a fix is available.

## Automated Security Checks

- CI enforces dependency vulnerability checks via `npm audit` on root, API, and frontend packages.
- Local maintainers can run:
  - `npm run security:audit` (production dependencies)
  - `npm run security:audit:full` (production + development dependencies)

## Disclosure Policy

- Please allow time for validation and patching before public disclosure.
- After a fix is released, we may publish a summary advisory with impact and mitigation details.
