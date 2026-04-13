# Lyra Overview

Lyra is the control plane and runtime management layer of the ABZU stack.

It does not implement low-level matching, backtest pricing logic, or stream processing by itself. Those responsibilities remain in Aurum and Loom. Lyra sits above them and turns single-shot engine execution into a manageable, queryable, monitorable system.

## Position In The Stack

The stack is organized as:

- `Loom` for streaming infrastructure, caches, plugins, and event primitives
- `Aurum` for execution, backtesting, and engine-level trading logic
- `Lyra` for run lifecycle management, daemon control, and runtime state
- `Prism` for visualization, inspection, and operator-facing monitoring

In practice the relationship looks like this:

```text
Prism  --->  lyrad  --->  Aurum  --->  Loom
lyra   --->  lyrad
```

This separation is intentional:

- `Aurum` is responsible for running a strategy or task
- `Lyra` is responsible for managing many runs and sessions over time
- `Prism` is responsible for observing, inspecting, and presenting them

## Components

### `lyrad`

`lyrad` is the long-running backend daemon and the actual control hub.

It is responsible for:

- maintaining run and session lifecycle
- exposing local control endpoints over Unix socket or TCP
- persisting runtime state, logs, and artifacts
- brokering requests from CLI and UI clients
- invoking Aurum engine execution
- providing the service surface that Prism can monitor

### `lyra`

`lyra` is the command-line client for operators and developers.

It does not own the authoritative runtime state. Instead, it sends control requests to `lyrad`, similar to how `docker` talks to `dockerd` or `systemctl` talks to `systemd`.

Typical responsibilities include:

- starting the daemon
- stopping the daemon
- querying daemon status
- submitting run-oriented management commands

### `Prism`

`Prism` is the graphical client. It connects to `lyrad` directly and uses Lyra's control surface as the source of truth for inspection, monitoring, and runtime views.

## What Lyra Manages

Lyra's main job is to manage two categories of runtime object.

### Backtest Runs

A backtest run is a bounded execution unit such as:

- running a built-in strategy
- running a configuration-defined program
- replaying a historical time range
- collecting outputs such as summary, fills, orders, positions, and logs

### Live Sessions

A live session is a long-lived runtime such as:

- ingesting exchange data continuously
- running factor transforms in the background
- executing a live strategy
- remaining active for supervision, introspection, and monitoring

Lyra therefore should not be thought of as a one-shot launcher. It is a runtime manager for runs and sessions.

## Operational Model

Lyra is built around a daemon-centered model:

- `lyrad` stays alive and owns lifecycle
- `lyra` issues operator commands
- `Prism` inspects and visualizes the current system state

That model gives the system:

- stable process ownership
- a single control surface for CLI and UI
- consistent runtime state and artifact tracking
- a clean separation between execution logic and operational management

## Example Workflow

An operator-facing flow typically looks like this:

1. `lyrad` starts and exposes its control endpoint.
2. `lyra` or `Prism` connects to that endpoint.
3. A backtest run or live session is created through Lyra.
4. `lyrad` invokes Aurum for execution and records runtime state.
5. Clients inspect status, logs, and outputs through the Lyra control plane.

## Related Docs

- [Lyra Commands](Commands.md)
- [Aurum Overview](../aurum/overview.md)
- [Loom Overview](../loom/overview.md)
