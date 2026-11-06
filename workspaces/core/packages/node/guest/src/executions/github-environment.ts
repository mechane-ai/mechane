/** The helper reads credentials from this command's environment, never from Git configuration or a file. */
const CREDENTIAL_HELPER = `!node -e '
if (process.argv[1] !== "get") process.exit(0);
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", chunk => { input += chunk; });
process.stdin.on("end", () => {
  const fields = Object.fromEntries(input.trim().split("\\n").map(line => {
    const offset = line.indexOf("=");
    return [line.slice(0, offset), line.slice(offset + 1)];
  }));
  const path = (fields.path || "").replace(/\\.git$/, "");
  if (fields.protocol === "https" && fields.host === "github.com" && path === process.env.GH_REPO && process.env.GH_TOKEN) {
    process.stdout.write("username=x-access-token\\npassword=" + process.env.GH_TOKEN + "\\n");
  }
});
'`;

/** Clears inherited helpers and supplies a path-scoped helper without changing durable Git configuration. */
export const GITHUB_ENVIRONMENT = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '3',
  GIT_CONFIG_KEY_0: 'credential.helper',
  GIT_CONFIG_VALUE_0: '',
  GIT_CONFIG_KEY_1: 'credential.helper',
  GIT_CONFIG_VALUE_1: CREDENTIAL_HELPER,
  GIT_CONFIG_KEY_2: 'credential.useHttpPath',
  GIT_CONFIG_VALUE_2: 'true',
} as const;
