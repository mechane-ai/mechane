from secrets import token_urlsafe

from anthropic import Anthropic, ConflictError


def verify_managed_vaults(client: Anthropic) -> None:
    """Rotating a bearer keeps it write-only and archiving its vault retires it."""
    vaults = client.beta.vaults
    vault = vaults.create(display_name="SDK vault qualification")
    token = token_urlsafe()
    replacement = token_urlsafe()
    auth = {"type": "static_bearer", "mcp_server_url": "https://mcp.example.test/tools?project=p", "token": token}

    def check_redaction(response) -> None:
        body = response.http_response.content
        leaked = token.encode() in body or replacement.encode() in body
        if leaked:
            raise AssertionError("A credential value appeared in a public response")

    try:
        created = vaults.credentials.with_raw_response.create(vault_id=vault.id, auth=auth)
        check_redaction(created)
        credential = created.parse()
        assert credential.auth.type == "static_bearer"
        assert credential.auth.mcp_server_url == auth["mcp_server_url"]
        try:
            vaults.credentials.create(
                vault_id=vault.id, auth={**auth, "mcp_server_url": "HTTPS://MCP.EXAMPLE.TEST:443/tools/?project=p"}
            )
        except ConflictError:
            pass
        else:
            raise AssertionError("Two active credentials acquired the same MCP server in a vault")

        rotated = vaults.credentials.with_raw_response.update(
            credential.id, vault_id=vault.id, auth={"type": "static_bearer", "token": replacement}
        )
        check_redaction(rotated)
        assert rotated.parse().id == credential.id
        check_redaction(vaults.credentials.with_raw_response.retrieve(credential.id, vault_id=vault.id))
        check_redaction(vaults.credentials.with_raw_response.list(vault_id=vault.id))
        vaults.archive(vault.id)
        assert list(vaults.credentials.list(vault_id=vault.id)) == []
        archived = vaults.credentials.retrieve(credential.id, vault_id=vault.id)
        assert archived.archived_at is not None
    finally:
        vaults.delete(vault.id)
