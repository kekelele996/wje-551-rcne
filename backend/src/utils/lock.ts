/**
 * 按键串行化异步任务：同一 key 的任务排队执行，
 * 不同 key 互不阻塞。用于保证同一采购单的并发到货登记只有一次生效。
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    // 无论任务成功与否都让链继续，否则一次失败会永久阻塞该 key
    const queued = previous.then(task, task);
    const tail = queued.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    });
    return queued;
  }
}
