/** Why the mech's hands refused a command before any machine: its workspace has no sandbox, or runs every machine. */
export const SandboxRefusal = { NoSandbox: 'no_sandbox', MachinesFull: 'machines_full' } as const;

export type SandboxRefusal = (typeof SandboxRefusal)[keyof typeof SandboxRefusal];
