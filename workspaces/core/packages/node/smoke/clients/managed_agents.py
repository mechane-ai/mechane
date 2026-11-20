# /// script
# requires-python = ">=3.10"
# dependencies = ["anthropic==2.10.0", "jsonschema==4.25.1"]
# ///
"""Check the published SDK and its wire schema against an explicit local Mechane endpoint."""

import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import anthropic
import httpx2
from jsonschema import Draft202012Validator
from referencing import Registry
from referencing.jsonschema import DRAFT202012

from managed_skills import verify_managed_skills
from managed_vaults import verify_managed_vaults

UPSTREAM = Path(__file__).resolve().parents[3] / "shared/managed-protocol/upstream/anthropic-v2.10.0.openapi.json.gz"
FAMILIES = {
    "agents", "sessions", "environments", "vaults", "memory_stores", "skills",
    "deployments", "deployment_runs", "dreams",
}
HOSTED_ONLY = {"deployments", "deployment_runs", "dreams"}
FIXTURE_URI = "urn:mechane:anthropic:2.10.0"


def upstream():
    data = UPSTREAM.read_bytes()
    expected = UPSTREAM.with_name("upstream.sha256").read_text().strip()
    if expected != f"{hashlib.sha256(data).hexdigest()}  {UPSTREAM.name}":
        raise ValueError("Published SDK fixture digest changed")
    return json.loads(gzip.decompress(data))


def inventory(spec):
    for path, operations in sorted(spec["paths"].items()):
        family = path.split("/")[2].split("?")[0]
        if family not in FAMILIES or not path.endswith("?beta=true"):
            continue
        for method, operation in sorted(operations.items()):
            print(method.upper(), path.removesuffix("?beta=true"), operation["operationId"],
                  "hosted-only" if family in HOSTED_ONLY else "upstream")


def sdk_wire():
    def capture(request):
        assert request.method == "GET" and request.url.path == "/v1/agents"
        assert request.url.params["limit"] == "1"
        assert request.headers["anthropic-beta"] == "managed-agents-2026-04-01"
        assert request.headers["anthropic-version"] == "2026-10-21"
        assert request.headers["authorization"] == "Bearer fixture"
        return httpx2.Response(200, json={"data": [], "next_page": None})

    with anthropic.Anthropic(
        base_url="http://127.0.0.1", api_key="fixture", max_retries=0,
        http_client=httpx2.Client(transport=httpx2.MockTransport(capture)),
    ) as client:
        assert client.beta.agents.list(limit=1).data == []
    print("PASS Python SDK request construction (capture only)")


def local_client():
    base = os.environ["ANTHROPIC_BASE_URL"]
    origin = urlsplit(base)
    if origin.hostname not in {"127.0.0.1", "::1", "localhost"} or origin.scheme not in {"http", "https"}:
        raise ValueError("Set ANTHROPIC_BASE_URL to the local celld origin")
    return anthropic.Anthropic(base_url=base, api_key=os.environ["ANTHROPIC_API_KEY"], max_retries=0, timeout=10)


def validate_json(spec, response, route, method):
    operation = spec["paths"][route + "?beta=true"][method]
    assert response.status_code == 200, operation["operationId"]
    assert response.headers["content-type"].split(";")[0] == "application/json"
    assert response.headers["request-id"], operation["operationId"]
    schema = operation["responses"]["200"]["content"]["application/json"]["schema"]
    registry = Registry().with_resource(FIXTURE_URI, DRAFT202012.create_resource(spec))
    validator = Draft202012Validator({"$ref": FIXTURE_URI + schema["$ref"]}, registry=registry)
    error = next(validator.iter_errors(response.json()), None)
    if error:
        raise ValueError(f'{operation["operationId"]} response failed schema at {error.json_path}: {error.validator}')


def capabilities(spec):
    failed = 0
    with local_client() as client:
        resources = {
            "agents": client.beta.agents, "sessions": client.beta.sessions,
            "environments": client.beta.environments, "skills": client.beta.skills,
            "vaults": client.beta.vaults, "memory_stores": client.beta.memory_stores,
            "deployments": client.beta.deployments, "deployment_runs": client.beta.deployment_runs,
            "dreams": client.beta.dreams,
        }
        for family, resource in resources.items():
            try:
                options = {"betas": ["managed-agents-2026-04-01"]} if family == "skills" else {}
                reply = resource.with_raw_response.list(limit=1, **options)
                validate_json(spec, reply.http_response, "/v1/" + family, "get")
                if family in HOSTED_ONLY:
                    raise ValueError("unexpected hosted-only collection")
            except anthropic.APIStatusError as error:
                if family in HOSTED_ONLY and error.status_code == 404:
                    print(f"ABSENT {family} (expected)")
                else:
                    failed += 1
                    print(f"FAIL {family}: HTTP {error.status_code}")
            except (ValueError, AssertionError, KeyError) as error:
                failed += 1
                print(f"FAIL {family}: {error}")
            else:
                print(f"PASS {family} collection read and response schema")
    if failed:
        raise SystemExit(f"{failed} collection checks failed")


def live(spec):
    def validate(raw, route, method):
        validate_json(spec, raw.http_response, route, method)
        return raw.parse()

    with local_client() as client:
        agents = client.beta.agents.with_raw_response
        name = "Python conformance " + uuid4().hex[:12]
        agent = validate(agents.create(name=name, model="claude-haiku-5-5"), "/v1/agents", "post")
        assert agent.name == name and agent.id.startswith("agent_")
        try:
            retrieved = validate(agents.retrieve(agent.id), "/v1/agents/{agent_id}", "get")
            assert retrieved.model_dump() == agent.model_dump()
            page = validate(agents.list(limit=1), "/v1/agents", "get")
            assert len(page.data) == 1
        finally:
            validate(agents.archive(agent.id), "/v1/agents/{agent_id}/archive", "post")
        print("PASS local Python SDK agent lifecycle and upstream response schemas")
        verify_managed_skills(client)
        print("PASS local Python SDK skill versions, pagination, binary downloads and pinned worker mounts")
        verify_managed_vaults(client)
        print("PASS local Python SDK credential rotation, write-only secrets, archival and deletion")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("check", choices=["inventory", "wire", "capabilities", "live"])
    args = parser.parse_args()
    spec = upstream()
    if args.check == "inventory":
        inventory(spec)
    elif args.check == "wire":
        sdk_wire()
    elif args.check == "capabilities":
        capabilities(spec)
    else:
        live(spec)
