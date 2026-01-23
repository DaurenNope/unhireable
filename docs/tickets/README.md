# Project Tickets

All tickets now live flatly inside `docs/tickets/` using a consistent filename format. This keeps Cursor search results tidy and makes it obvious when a ticket is missing metadata.

## Naming Convention

```
ticket-<scope>-<id>[-<suffix>].md
```

- `scope` is the capability or subsystem (e.g., `deploy`, `test`, `sec`)
- `id` is a zero-padded number that matches the ticket header (e.g., `001`)
- `suffix` is optional when multiple artifacts exist for the same ticket (e.g., test reports)

Example: `ticket-test-001.md`

## File Layout

```
docs/
  tickets/
    README.md                # this file
    ticket-deploy-001.md     # active ticket
    ticket-test-001.md       # active ticket
    ticket-aut-001-test-report.md
```

No nested priority folders remain. Capture priority, status, and owner in the ticket body itself.

## Ticket Template

Each ticket should contain:

1. **Summary** – one paragraph on the outcome.
2. **Scope & Priority** – tags that tools can parse (e.g., `priority: high`).
3. **Context** – background, links, screenshots.
4. **Implementation** – actionable steps.
5. **Testing** – how to verify the change.
6. **Status Log** – brief update history.

Feel free to copy an existing ticket and update the metadata.

## Adding a Ticket

1. Create a new file under `docs/tickets/` using the naming convention.
2. Populate the template above.
3. Link to related tickets or docs where helpful.

## Reports & Attachments

If a ticket has multiple reports (e.g., verification + retrospective), append a suffix: `ticket-test-001-report.md`. Keep everything in this folder so the history stays co-located.

## Cleanup Rules

- Do **not** create new priority folders.
- Keep ticket names lowercase and hyphenated.
- Archive deprecated tickets under `labs/` only if the content is no longer actionable.

Use `docs/process/repo-structure.md` for overall repository conventions.
