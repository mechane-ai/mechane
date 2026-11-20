output "origin" {
  description = "Origin for Mechane's CLI, SDK, and runtime API."
  value       = local.origin
  depends_on  = [cloudflare_workers_custom_domain.service]
}

output "version" {
  description = "Installed public Mechane release."
  value       = local.installation.version
}

output "console_url" {
  description = "Browser console included with this installation."
  value       = "${local.origin}/console"
  depends_on  = [cloudflare_workers_custom_domain.service]
}

output "resources" {
  description = "Cloudflare resource identities for inventory and support."
  value = {
    worker_id               = cloudflare_worker.service.id
    worker_name             = cloudflare_worker.service.name
    worker_version_id       = mechane_cloudflare_worker_release.release.version_id
    workspace_bucket        = cloudflare_r2_bucket.workspace_files.name
    machine_application_id  = try(mechane_cloudflare_machine_application.machines[0].id, null)
    machine_namespace_id    = mechane_cloudflare_worker_release.release.durable_object_namespaces["MachineObject"]
    sandbox_namespace_id    = mechane_cloudflare_worker_release.release.durable_object_namespaces["SandboxObject"]
    mech_namespace_id       = mechane_cloudflare_worker_release.release.durable_object_namespaces["MechObject"]
    agent_slot_namespace_id = mechane_cloudflare_worker_release.release.durable_object_namespaces["AgentSlotObject"]
    session_namespace_id    = mechane_cloudflare_worker_release.release.durable_object_namespaces["SessionObject"]
    guest_image             = try(mechane_cloudflare_container_image.guest[0].image, var.sandboxes.image)
  }
}
