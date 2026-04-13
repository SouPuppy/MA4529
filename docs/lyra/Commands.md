# Lyra Commands

`lyra` is the CLI used to start, inspect, and stop the `lyrad` control daemon.

For the architectural role of Lyra in the ABZU stack, see [Lyra Overview](overview.md).

## Usage

```bash
lyra [--tcp [host:port]] {start|status|stop}
```

`--tcp` may appear either before or after the subcommand:

```bash
lyra --tcp start
lyra start --tcp
lyra --tcp 127.0.0.1:9441 start
lyra start --tcp 127.0.0.1:9441
```

If `--tcp` is omitted, `lyrad` uses a Unix domain socket.

## Transport Modes

### Unix Socket Mode

Default mode without `--tcp`.

- Control endpoint: runtime socket path
- Example:

```bash
lyra start
lyra status
```

Typical output:

```text
lyrad started (pid=12345) sock=/tmp/lyra/lyrad.sock
lyrad is running (pid=12345) sock=/tmp/lyra/lyrad.sock
```

On macOS the socket path is typically under `$TMPDIR/lyra/lyrad.sock`.

### TCP Mode

Use `--tcp` to expose the control plane over TCP instead of a Unix socket.

- Default host: `127.0.0.1`
- Default port: `9441`

Examples:

```bash
lyra --tcp start
lyra --tcp status
lyra --tcp stop
```

```bash
lyra --tcp 127.0.0.1:9441 start
lyra --tcp 0.0.0.0:9441 start
lyra start --tcp :9442
```

Typical output:

```text
lyrad started (pid=12345) tcp=127.0.0.1:9441
lyrad is running (pid=12345) tcp=127.0.0.1:9441
```

## Commands

### `start`

Starts `lyrad` if it is not already running.

- If a daemon is already active, `lyra` reports the current endpoint instead of starting another one.
- The start output includes the daemon PID and the active control endpoint.

Examples:

```bash
lyra start
lyra --tcp start
lyra start --tcp 127.0.0.1:9441
```

### `status`

Checks whether `lyrad` is reachable and reports the active control endpoint.

- TCP mode prints `tcp=host:port`
- Unix socket mode prints `sock=/path/to/socket`

Examples:

```bash
lyra status
lyra --tcp status
```

Typical outputs:

```text
lyrad is running (pid=12345) tcp=127.0.0.1:9441
lyrad is running (pid=12345) sock=/tmp/lyra/lyrad.sock
lyrad is not running
```

### `stop`

Stops the running `lyrad` daemon through the active control endpoint.

Examples:

```bash
lyra stop
lyra --tcp stop
```

Typical output:

```json
{"status":"stopping"}
```

## Address Rules For `--tcp`

`--tcp` accepts these forms:

| Form | Meaning |
|------|---------|
| `--tcp` | Use `127.0.0.1:9441` |
| `--tcp 127.0.0.1` | Use host `127.0.0.1`, default port `9441` |
| `--tcp :9442` | Use default host `127.0.0.1`, port `9442` |
| `--tcp 0.0.0.0:9441` | Use explicit host and port |

## Daemon Discovery

`lyra start` resolves the daemon executable in this order:

1. `LYRA_DAEMON` if it points to an executable.
2. `lyrad` next to the `lyra` executable.

## Runtime State

`lyrad` stores runtime files in the platform runtime directory:

- `lyrad.pid`
- `lyrad.state`
- `lyrad.sock` in Unix socket mode

The `lyrad.state` file records whether the daemon is running in `tcp` or `sock` mode, and `lyra status` uses it to report the active endpoint consistently.
