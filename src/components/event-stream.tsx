const EventStream = ({ events }: { events: string[] }) => {
  return (
    <section className="min-w-0 md:pl-8" aria-label="EventStream">
      <h2 className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
        EventStream
      </h2>
      <div className="overflow-auto pb-6 font-mono text-xs leading-relaxed">
        {events.length === 0 ? (
          <p className="text-muted-foreground">No events</p>
        ) : (
          <ol aria-live="polite" className="space-y-4">
            {events.map((event, index) => (
              <li key={index} className="flex gap-3 whitespace-nowrap">
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {index + 1}
                </span>
                <div>
                  {event.split('\n').map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

export { EventStream }
