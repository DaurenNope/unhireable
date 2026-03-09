# Project Control System

This folder exists to keep the project aligned, traceable, and cheap to load for both humans and agents.

## Purpose

Unhireable is a fast-moving project with a lot of possible directions. This system exists to prevent:

- re-deciding the same things every session
- losing track of what is active
- accidental scope creep
- parallel systems that solve the same problem twice
- token waste from reading too much irrelevant history

## Canonical Read Order

Every agent should follow this read order:

1. `project-ledger.yaml`
2. `docs/process/project-control/current-phase.md`
3. `docs/tickets/README.md`
4. only the specific active ticket needed for the task

Do **not** read the whole repo history or all tickets by default.

## File Roles

### `project-ledger.yaml`
The root control file.

Use it for:
- current mission
- current strategy
- active phase
- active ticket queue
- blockers
- recent meaningful changes

This file must stay short and current.

### `decisions.md`
Durable strategic decisions only.

Use it for:
- product direction
- architectural choices
- major prioritization decisions
- explicit reversals of prior decisions

Do not use it for temporary execution notes.

### `current-phase.md`
The current execution boundary.

Use it for:
- what phase is active
- what the goal is
- what is in scope
- what is out of scope
- what "done" means for the phase

This is the main anti-scope-creep file.

### `change-log.md`
A running project-level history.

Use it for:
- major product decisions
- completed meaningful work
- shifts in direction
- removals of previously active ideas

Do not log every small code change.

### `docs/tickets/README.md`
Ticket index and queue.

Use it for:
- active tickets
- blocked tickets
- done tickets
- execution order

### `docs/tickets/ticket-*.md`
Execution documents for specific work.

Use them for:
- problem definition
- scope
- files affected
- acceptance criteria
- implementation notes
- outcome summary

Completed tickets remain as history, but are not part of the normal default read path.

## Update Rules

### Update `project-ledger.yaml` when:
- strategy changes
- active phase changes
- ticket status changes
- blockers appear or are cleared
- the current focus changes

### Update `decisions.md` when:
- a meaningful strategic decision is made
- a previous strategic decision is reversed

### Update `current-phase.md` when:
- scope for the active phase changes
- the sequence changes
- definition of done changes

### Update `change-log.md` when:
- meaningful project-level progress happens
- a phase milestone is completed
- a major decision is made

### Update a ticket file when:
- implementation details change
- blockers appear
- scope is tightened
- the ticket is completed

## Mandatory Behavior for Agents

- Read `project-ledger.yaml` first
- Respect the active phase boundaries
- Do not invent new scope without recording it
- Do not create parallel implementations casually
- Do not treat old ticket detail as current truth
- If blocked, record the blocker
- If a ticket is done, summarize the outcome and move it out of the active path

## Guiding Principle

The root ledger is the current truth.  
The process files provide context.  
Tickets provide execution detail.  
Completed tickets are history, not the default operating context.