# Pull Request Descriptions

Use [pull_request_template.md](pull_request_template.md) as the canonical PR body. It keeps the problem/result, verification evidence, and merge impact in three sections. Write in English; GitHub issue content remains in Portuguese under the team's agreed convention.

- Keep the description proportional to the change. Prefer a few concrete statements; link detailed rationale, logs, and ADRs rather than repeating them.
- Reference the originating issue or explain why there is none. Use closing keywords only when the PR actually satisfies the issue's acceptance criteria.
- Fill each verification field with commands/results or N/A and a reason. Documentation-only PRs require link/diff checks; application changes require the relevant configured checks.
- Check GitHub's actual base selector. Feature PRs target `develop`; editing a branch name in the description does not change the PR target.
- Assess rollback compatibility when selecting One-way or Two-way, especially for migrations, credential formats, and API contracts. The checklist reports evidence; it does not replace review.

## Loading the template

GitHub automatically discovers the template once it exists on the repository's default branch. Introducing it through `develop` follows this project's Git Flow; availability in the web UI then follows normal integration into the default branch. Check the current default with `gh repo view --json defaultBranchRef`. See [GitHub's template documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository).

To use the checked-out template immediately through the GitHub CLI:

```sh
gh pr create --base develop --template .github/pull_request_template.md
```

Complete the fields in the interactive editor before publishing. For releases or hotfixes, select the appropriate base explicitly.
