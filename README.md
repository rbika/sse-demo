# SSE Demo

This is a companion demo for the [Working with Server-Sent Events](https://rbika.com/blog/working-with-server-sent-events) blog post.

Check the [live demo](https://sse-demo-rbika.vercel.app/).

## How to use

Pick a Strategy if you want Fetch instead of EventSource, then click **Simulate success** or **Simulate error**. Those start a Run with Outcome success (every Step completes) or error (Testing fails; later Steps are skipped). Switching Strategy remounts the other consumer at Idle.

Pipeline is on the left. EventStream is on the right with the Snapshots received since the last Run started, in arrival order.

## Development

### Install dependencies

```bash
npm install
```

### Run the dev server

```bash
npm run dev
```

### Tests

```bash
npm test
```

### `GET /api/run`

Query `outcome` must be `success` or `error`.

Each event is named `run`. `data` is a JSON Snapshot of every Step:

```
event: run
data: [{"name":"Cloning","status":"running"},{"name":"Installing dependencies","status":"pending"},...]
```
