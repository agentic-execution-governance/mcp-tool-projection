# Real MCP Trace Experiment Runbook

This runbook supports #9, the real MCP trace experiment and blog post.

## Research Question

For the same agent task, does a least-privilege MCP profile reduce schema context and unused tool exposure while preserving task completion?

## Task Prompt

Use the same prompt for both runs:

```text
Inspect this repository and identify one small improvement to the MCP trace summary or measurement workflow. Implement the change, run the relevant validation, and prepare a concise pull request summary describing what changed and how it was verified.
```

## Profiles

Baseline:

```text
profiles/experiments/real-full.yaml
```

Projected:

```text
profiles/experiments/real-minimal.yaml
```

## Trace Outputs

Baseline trace:

```text
traces/experiments/real-full.jsonl
```

Projected trace:

```text
traces/experiments/real-minimal.jsonl
```

## Controls To Fill Before Running

| Control                    | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Agent client               | TBD                                                                                   |
| Model                      | TBD                                                                                   |
| Model settings             | TBD                                                                                   |
| Repository commit          | TBD                                                                                   |
| Working directory          | `/home/dev/code/github/agentic-execution-governance/experimental/mcp-tool-projection` |
| Network access             | TBD                                                                                   |
| MCP server versions        | TBD                                                                                   |
| Run order                  | Baseline first, projected second                                                      |
| Manual intervention policy | TBD                                                                                   |

## Preflight

```bash
npm install
npm run build:ts
npm test
npm run lint
npm run dev -- profile validate profiles/experiments/real-full.yaml
npm run dev -- profile validate profiles/experiments/real-minimal.yaml
npm run dev -- profile measure profiles/experiments/real-full.yaml
npm run dev -- profile measure profiles/experiments/real-minimal.yaml
```

## Baseline Run

Start the broad profile proxy:

```bash
mkdir -p traces/experiments
npm run dev -- serve --profile profiles/experiments/real-full.yaml --trace traces/experiments/real-full.jsonl
```

Connect the agent client to that proxy and run the task prompt exactly as written above.

After the run:

```bash
git status --short
npm run dev -- trace summarize traces/experiments/real-full.jsonl
```

Record:

- whether the task completed
- files changed
- validation command and result
- irrelevant tool calls
- failed tool calls
- any manual intervention

## Reset Between Runs

Use the safest reset procedure for the environment. If preserving the baseline output, save the diff first.

Recommended options:

- run each profile in a fresh clone, or
- commit/stash the baseline changes, then restore the exact starting commit, or
- document every manual cleanup step before the projected run

Record the exact reset procedure here before publishing.

## Projected Run

Start the minimal profile proxy:

```bash
mkdir -p traces/experiments
npm run dev -- serve --profile profiles/experiments/real-minimal.yaml --trace traces/experiments/real-minimal.jsonl
```

Connect the same agent client to that proxy and run the same task prompt.

After the run:

```bash
git status --short
npm run dev -- trace summarize traces/experiments/real-minimal.jsonl
```

Record the same outcome notes as the baseline run.

## Generate Comparison

```bash
npm run dev -- trace summarize traces/experiments/real-full.jsonl traces/experiments/real-minimal.jsonl
npm run dev -- trace summarize traces/experiments/real-full.jsonl traces/experiments/real-minimal.jsonl --format json
```

Copy the table into:

```text
docs/experiments/real-results.md
```

## Qualitative Scorecard

| Criterion                   | Baseline | Projected | Notes |
| --------------------------- | -------- | --------- | ----- |
| Task completed              | TBD      | TBD       | TBD   |
| Validation passed           | TBD      | TBD       | TBD   |
| Relevant files found        | TBD      | TBD       | TBD   |
| Irrelevant tool calls       | TBD      | TBD       | TBD   |
| Failed tool calls           | TBD      | TBD       | TBD   |
| Unsafe unused tools exposed | TBD      | TBD       | TBD   |
| Manual intervention         | TBD      | TBD       | TBD   |

## Publication Notes

- Treat one pair of runs as a case study, not a benchmark.
- Publish redacted traces if raw traces include private paths, names, or content.
- Tie every claim to either the generated metrics table or the qualitative scorecard.
