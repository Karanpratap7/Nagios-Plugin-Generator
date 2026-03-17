import crypto from "crypto";
import path from "path";
import { PluginInput, GeneratedPluginMeta, slugifyName } from "./schema";

export interface GenerateOptions {
  outputDir: string;
}

export function generatePluginScript(
  input: PluginInput,
  options: GenerateOptions
): GeneratedPluginMeta {
  const id = crypto.randomBytes(6).toString("hex");
  const slug = slugifyName(input.name);
  const filename = `${slug}_${id}.sh`;

  const safeOutputDir = path.resolve(options.outputDir);
  const relativePath = filename;
  const absolutePath = path.join(safeOutputDir, filename);

  const script = buildBashScript(input);

  return {
    id,
    filename,
    relativePath,
    absolutePath,
    content: script
  };
}

function escapeForDoubleQuotes(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildBashScript(input: PluginInput): string {
  const description = input.description || "Nagios plugin";
  const author = input.author || "Unknown";
  const version = input.version || "1.0.0";
  const command = input.command.trim();

  const warning = input.warningThreshold || "";
  const critical = input.criticalThreshold || "";
  const template =
    input.outputTemplate || "CHECK: ${STATUS_TEXT} - ${DETAILS:-no details}";

  const shebang = "#!/usr/bin/env bash";

  const header = `# ${description}
# Author: ${author}
# Version: ${version}
#
# Nagios exit codes:
#   OK=0, WARNING=1, CRITICAL=2, UNKNOWN=3

`;

  const body = `
STATE_OK=0
STATE_WARNING=1
STATE_CRITICAL=2
STATE_UNKNOWN=3

STATUS_TEXT="UNKNOWN"
DETAILS=""

print_help() {
  cat <<EOF
${escapeForDoubleQuotes(description)}

Usage: \\$0

Runs the following command and interprets the result as a Nagios plugin.
Command (not executed by this script until runtime):
  ${escapeForDoubleQuotes(command)}

Exit codes:
  OK=0, WARNING=1, CRITICAL=2, UNKNOWN=3
EOF
}

print_version() {
  echo "${escapeForDoubleQuotes(version)}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      print_help
      exit $STATE_OK
      ;;
    -V|--version)
      print_version
      exit $STATE_OK
      ;;
    *)
      echo "Unknown option: $1"
      exit $STATE_UNKNOWN
      ;;
  esac
done

CMD_OUTPUT=""
CMD_EXIT=0

# NOTE: This command is user-supplied and is only run when the plugin is executed by Nagios.
CMD_OUTPUT=$(eval "${escapeForDoubleQuotes(command)}" 2>&1)
CMD_EXIT=$?

DETAILS="$CMD_OUTPUT"

if [[ $CMD_EXIT -eq 0 ]]; then
  STATUS_TEXT="OK"
  EXIT_CODE=$STATE_OK
elif [[ -n "${escapeForDoubleQuotes(critical)}" && $CMD_EXIT -ne 0 ]]; then
  STATUS_TEXT="CRITICAL"
  EXIT_CODE=$STATE_CRITICAL
elif [[ -n "${escapeForDoubleQuotes(warning)}" && $CMD_EXIT -ne 0 ]]; then
  STATUS_TEXT="WARNING"
  EXIT_CODE=$STATE_WARNING
else
  STATUS_TEXT="UNKNOWN"
  EXIT_CODE=$STATE_UNKNOWN
fi

MESSAGE="${template}"
eval "echo \\"$MESSAGE\\""

exit $EXIT_CODE
`.trimStart();

  return `${shebang}

${header}${body}
`;
}

