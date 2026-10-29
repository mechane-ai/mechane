/** A waiting CLI's notice: its whole line, the device page to open, and the code to type there. */
export type ApprovalNotice = { readonly line: string; readonly url: URL; readonly userCode: string };
