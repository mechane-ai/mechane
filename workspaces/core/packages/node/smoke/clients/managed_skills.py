import asyncio
import base64
import json
from contextlib import ExitStack
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import Request, urlopen
from uuid import uuid4
from zipfile import ZipFile

from anthropic import Anthropic, AsyncAnthropic, BadRequestError, NotFoundError
from anthropic.lib import files_from_dir
from anthropic.lib.tools.agent_toolset import AgentToolContext


def verify_managed_skills(client: Anthropic) -> None:
    """Uploading a new version keeps older worker downloads byte-for-byte reproducible."""
    with TemporaryDirectory() as temporary:
        bundle = Path(temporary) / "release-notes"
        bundle.mkdir()
        manifest = bundle / "SKILL.md"
        manifest.write_text("---\nname: release-notes\ndescription: Release notes.\n---\n", encoding="utf-8")
        data = bundle / "fixtures" / "receipt.bin"
        data.parent.mkdir()
        original = b"\x00\xff\x12"
        data.write_bytes(original)

        skill = client.skills.create(files=files_from_dir(bundle))
        try:
            data.write_bytes(b"new")
            version = client.beta.skills.versions.create(skill_id=skill.id, files=files_from_dir(bundle))
            assert version.id != skill.latest_version_id
            versions = client.beta.skills.versions.list(skill_id=skill.id, limit=1)
            assert [entry.id for entry in versions] == [version.id, skill.latest_version_id]

            response = client.beta.skills.versions.download(skill.latest_version_id, skill_id=skill.id)
            with ZipFile(BytesIO(response.read())) as archive:
                assert archive.read("release-notes/fixtures/receipt.bin") == original

            verify_worker_mount(client, Path(temporary), skill.id, skill.latest_version_id, version.id, original)
        finally:
            client.skills.delete(skill.id)

def verify_worker_mount(owner, directory, skill_id, pinned, other, original):
    sessions, agents, environments = owner.beta.sessions, owner.beta.agents, owner.beta.environments
    name = "skill-mount-" + uuid4().hex
    model = "claude-haiku-5-5"
    tools = [{"type": "agent_toolset_20260401"}]
    selected = {"type": "custom", "skill_id": skill_id, "version": pinned}

    with ExitStack() as cleanup:
        env = environments.create(name=name, config={"type": "self_hosted"})
        cleanup.callback(environments.archive, env.id)
        child = agents.create(name=name + "-child", model=model, skills=[selected], tools=tools)
        cleanup.callback(agents.archive, child.id)
        roster = {"type": "coordinator", "agents": [{"type": "agent", "id": child.id, "version": child.version}]}
        coordinator = agents.create(name=name, model=model, multiagent=roster)
        cleanup.callback(agents.archive, coordinator.id)
        session = sessions.create(environment_id=env.id, agent=coordinator.id)
        cleanup.callback(sessions.delete, session.id)
        assert sessions.retrieve(session.id).agent.skills == []

        try:
            sessions.create(environment_id=env.id, agent={
                "type": "agent_with_overrides", "id": coordinator.id, "tools": tools, "skills": [{**selected, "version": other}],
            })
        except BadRequestError as error:
            assert "mount name" in error.message
        else:
            raise AssertionError("Two versions cannot occupy the same skill path")

        url = str(owner.base_url).rstrip("/") + f"/internal/managed/environments/{env.id}/keys"
        request = Request(url, method="POST", headers={"Authorization": f"Bearer {owner.api_key}"})
        with urlopen(request, timeout=10) as response:
            key = json.load(response)["key"]
        environment = cleanup.enter_context(Anthropic(base_url=owner.base_url, auth_token=key, max_retries=0))
        work = environment.beta.environments.work.poll(env.id, block_ms=500)
        assert work is not None and work.data.id == session.id
        environment.beta.environments.work.ack(work.id, environment_id=env.id)
        secret = json.loads(base64.urlsafe_b64decode(work.secret + "==="))
        asyncio.run(check_worker_files(owner.base_url, secret["sessions_token"], session.id, directory,
                                       selected, other, original))


async def check_worker_files(base_url, token, session_id, directory, selected, other, original):
    async with AsyncAnthropic(base_url=base_url, auth_token=token, max_retries=0) as worker:
        session = await worker.beta.sessions.retrieve(session_id)
        assert [ref.model_dump() for ref in session.agent.skills] == [selected]
        async with AgentToolContext(workdir=directory, client=worker, session=session):
            mounted = directory / "skills" / "release-notes"
            assert (mounted / "fixtures/receipt.bin").read_bytes() == original
            assert (mounted / "SKILL.md").is_file()

        try:
            await worker.beta.skills.versions.download(other, skill_id=selected["skill_id"])
        except NotFoundError:
            return
        raise AssertionError("Worker downloaded a version not pinned in its roster")
