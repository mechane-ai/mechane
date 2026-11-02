# Authentication

Authenticates API keys and browser sessions against the installation's directory. Browser writes require the exact
installation origin. Workspace admission remains in the API edge and reads current membership for every request.

The pages package uses the same cookie and session operations for local login, GitHub login, and device approval.
Session cookies are HttpOnly and host-only. The directory stores only token hashes.
