/** What a guest sent back for an execution's request: its status and its body's text. */
export type GuestReply = { readonly status: number; readonly body: string };
