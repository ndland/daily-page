/**
 * Runs tasks one after another, in the order they were asked for. Each write reads the note and
 * writes it back, so two writes running at once could each act on text the other is about to change.
 * Queuing them keeps the order the reader made them in, and makes an undo see the edit before it.
 */
export class WriteQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    // A failed task must not stop the tasks queued after it, so the queue keeps going either way.
    this.tail = result.catch(() => undefined);
    return result;
  }
}
