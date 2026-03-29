# Vercel + Turborepo in this repo

## Root directory

Each app under `apps/*` has its own [`vercel.json`](../apps/home/vercel.json). Install, build, and ignore commands **must run from the monorepo root** (where `pnpm-workspace.yaml` and root `package.json` live).

Commands use:

```sh
cd "$(git rev-parse --show-toplevel)"
```

so they work whether the Vercel project **Root Directory** is set to `apps/<app>` **or** to the repository root. The older `cd ../..` pattern only matched when Root Directory was exactly `apps/<app>`.

## Ignored build step (`ignoreCommand` / `turbo-ignore`)

Vercel runs `ignoreCommand` first. Exit codes:

| Exit code | Meaning on Vercel        |
|----------|---------------------------|
| `0`      | **Skip** this deployment |
| non-zero | **Continue** with install/build |

`turbo-ignore` exits `0` when the workspace and its dependencies are unchanged for the comparison range; it exits non-zero when a build should run.

### Reading build logs

A line like `Running "… pnpm exec turbo-ignore home"` only shows the command **starting**. To tell what happened:

1. Scroll for the next lines: stdout from `turbo-ignore` (e.g. “Proceeding with deployment” vs “Skipping”).
2. Check whether the deployment is **Canceled** / **Skipped** vs **Building** / **Error**.

If the step **errors** (red, non-zero with stderr), common causes are: missing `git` history, or `turbo-ignore` unable to resolve the baseline; see [Turborepo skipping tasks](https://turborepo.com/docs/guides/skipping-tasks) and `turbo-ignore --help` for `--fallback`.

### Deprecation

`turbo-ignore` prints a deprecation notice in favor of `turbo query affected`. Migration is optional; behavior here remains valid until you adopt the new flow.

## Local sanity check

From anywhere in the repo:

```sh
cd "$(git rev-parse --show-toplevel)"
pnpm exec turbo-ignore home
```

Compare the printed message and exit code with the table above (`echo $?` right after).
