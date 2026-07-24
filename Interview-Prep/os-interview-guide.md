# Operating Systems Interview Guide - Zero to Advanced

> A complete, structured guide covering processes, threads, scheduling, memory management, virtual memory, concurrency, deadlocks, and file systems - the OS fundamentals every backend and systems engineer must know for interviews.

---

## Table of Contents

1. [What an Operating System Actually Does](#what-an-operating-system-actually-does)
2. [Processes vs Threads](#processes-vs-threads)
3. [Process States & the Process Control Block](#process-states--the-process-control-block)
4. [Context Switching](#context-switching)
5. [CPU Scheduling](#cpu-scheduling)
6. [Inter-Process Communication (IPC)](#inter-process-communication-ipc)
7. [Concurrency & Synchronization](#concurrency--synchronization)
8. [Deadlocks](#deadlocks)
9. [Memory Management](#memory-management)
10. [Virtual Memory & Paging](#virtual-memory--paging)
11. [Page Replacement Algorithms](#page-replacement-algorithms)
12. [File Systems](#file-systems)
13. [I/O & System Calls](#io--system-calls)
14. [User Mode vs Kernel Mode](#user-mode-vs-kernel-mode)
15. [Common Interview Questions](#common-interview-questions)

---

## What an Operating System Actually Does

An operating system is the layer between your programs and the hardware. It exists so that thousands of programs can share one machine without stepping on each other.

```
+-----------------------------------------------+
|            User Applications                  |   (browser, editor, your code)
+-----------------------------------------------+
|            System Call Interface              |   (read, write, fork, mmap...)
+-----------------------------------------------+
|                 Kernel                        |
|  Scheduler | Memory Mgr | File System | Drivers|
+-----------------------------------------------+
|                 Hardware                      |   (CPU, RAM, disk, network)
+-----------------------------------------------+
```

The four core responsibilities:

| Responsibility | What it means |
|----------------|---------------|
| **Process management** | Create, schedule, and terminate programs; share the CPU fairly |
| **Memory management** | Give each process its own address space; decide what stays in RAM |
| **File system** | Store data on disk as named files with permissions |
| **I/O & devices** | Talk to disks, network cards, keyboards through drivers |

**In short:** the OS is a resource manager and an abstraction layer. It turns "one CPU, one block of RAM, one disk" into "every program thinks it has its own CPU, its own memory, and its own files."

---

## Processes vs Threads

This is the single most common OS interview question. Get it crisp.

A **process** is a program in execution - it owns an independent address space (its own memory, file descriptors, and resources). A **thread** is a unit of execution *inside* a process. All threads in a process share the same address space but have their own stack and registers.

```
Process A                          Process B
+---------------------------+      +---------------------------+
|  Code | Data | Heap       |      |  Code | Data | Heap       |
|                           |      |                           |
|  Thread 1   Thread 2      |      |  Thread 1                 |
|  [stack]    [stack]       |      |  [stack]                  |
|  [regs]     [regs]        |      |  [regs]                   |
+---------------------------+      +---------------------------+
      ^ shared heap/data                 (fully isolated from A)
```

| | Process | Thread |
|---|---------|--------|
| **Memory** | Separate address space | Shared within the process |
| **Creation cost** | Expensive (copy/setup) | Cheap |
| **Communication** | IPC (pipes, sockets, shared mem) | Shared variables (fast) |
| **Crash impact** | One crash doesn't kill others | One thread crash can kill the whole process |
| **Context switch** | Slower (swap page tables) | Faster (same address space) |

**When to use which:**
- **Multiple processes** → isolation and fault tolerance matter (e.g. Chrome tabs, Nginx workers).
- **Multiple threads** → shared state and low-latency communication matter (e.g. a web server handling many requests over one cache).

> **Interview trap:** "Is a thread lighter than a process?" Yes - because threads skip the expensive part: creating a new address space and copying resources. But that shared memory is exactly why threads need locks and processes usually don't.

---

## Process States & the Process Control Block

A process moves through a small set of states over its lifetime:

```
        admitted            dispatch             exit
  NEW ----------> READY --------------> RUNNING ---------> TERMINATED
                    ^                     |
                    |  I/O or event       | I/O request or
                    |  completes          | wait for event
                    |                     v
                    +-------- WAITING ----+
                        (a.k.a. BLOCKED)
```

- **New** - being created.
- **Ready** - waiting for the CPU (all it needs is a turn).
- **Running** - currently executing on a CPU core.
- **Waiting/Blocked** - waiting for something (disk read, network, lock).
- **Terminated** - finished; resources being reclaimed.

The OS tracks each process with a **Process Control Block (PCB)** - a data structure holding:

- Process ID (PID) and parent PID
- Process state
- Program counter and CPU registers (saved on context switch)
- Memory info (page tables, base/limit)
- Open file descriptors
- Scheduling priority and accounting info

> **Zombie vs Orphan:** A **zombie** has finished executing but its parent hasn't read its exit status yet (`wait()`), so its PCB lingers. An **orphan** is a child whose parent died first - it gets re-parented to `init`/`systemd` (PID 1), which reaps it.

---

## Context Switching

A **context switch** is the OS saving the state of one process/thread and restoring another so a single CPU core can be shared.

```
Process A running
      |
      | timer interrupt / syscall / block
      v
[Save A's registers, PC, stack pointer -> A's PCB]
      |
[Scheduler picks B]
      |
[Load B's registers, PC, stack pointer <- B's PCB]
      |
      v
Process B running
```

Context switches are pure overhead - no useful work happens during the switch. Costs include:

- Saving/restoring registers and program counter.
- Switching the page table (flushing the **TLB** - the cache of virtual→physical address translations - which then has to warm up again).
- Polluting CPU caches with the new process's data.

This is why thread switches are cheaper than process switches: threads share the address space, so no page table swap and no full TLB flush.

---

## CPU Scheduling

The scheduler decides which ready process runs next. Two broad families:

- **Non-preemptive** - a process keeps the CPU until it blocks or finishes.
- **Preemptive** - the OS can forcibly take the CPU away (e.g. on a timer tick). Modern OSes are preemptive.

### Key metrics

| Metric | Definition | Goal |
|--------|-----------|------|
| **Throughput** | Processes completed per unit time | Maximize |
| **Turnaround time** | Completion − arrival | Minimize |
| **Waiting time** | Time spent in the ready queue | Minimize |
| **Response time** | First response − arrival | Minimize (interactive systems) |

### Common algorithms

| Algorithm | Idea | Pros | Cons |
|-----------|------|------|------|
| **FCFS** | First come, first served | Simple, fair by arrival | Convoy effect - one long job blocks everyone |
| **SJF** | Shortest job first | Optimal average wait | Needs to know burst time; long jobs can starve |
| **Round Robin** | Each process gets a time quantum, then rotates | Great response time, fair | Quantum too small → switch overhead; too large → acts like FCFS |
| **Priority** | Highest priority runs first | Flexible | Starvation of low priority (fix with **aging**) |
| **Multilevel Feedback Queue** | Multiple queues; jobs move between them based on behavior | Adapts to CPU-bound vs I/O-bound | Complex to tune |

**Round Robin example** (quantum = 2):

```
Queue: P1(5)  P2(3)  P3(1)

Time: 0   2   4   5   7   9  10  11
      |P1 |P2 |P3 |P1 |P2 |P1 |...
       run run done run done run

P3 finishes fast (short job), no single job hogs the CPU.
```

> **Interview trap:** "Why not always use SJF if it's optimal?" Because you rarely know a job's burst length in advance, and it starves long jobs. Real schedulers (like Linux's CFS) approximate fairness instead - CFS tracks "virtual runtime" and always runs the process that has had the least CPU time so far.

---

## Inter-Process Communication (IPC)

Since processes have separate address spaces, they need explicit mechanisms to talk:

| Mechanism | How it works | Notes |
|-----------|--------------|-------|
| **Pipes** | Byte stream between related processes (`ls \| grep`) | Unidirectional; named pipes (FIFOs) work across unrelated processes |
| **Message queues** | OS-managed queue of discrete messages | Structured, decoupled |
| **Shared memory** | Two processes map the same physical pages | Fastest (no copy) but needs synchronization |
| **Sockets** | Network or local (Unix domain) endpoints | Works across machines |
| **Signals** | Async notifications (`SIGTERM`, `SIGKILL`) | Simple events, not data transfer |

**Shared memory is the fastest** because data isn't copied through the kernel - both processes read/write the same physical RAM. The trade-off: you now own the synchronization problem (see below).

---

## Concurrency & Synchronization

When multiple threads touch shared data, you get **race conditions** - the result depends on timing. The classic example:

```
Two threads both run: balance = balance + 100  (starting balance = 0)

Thread A reads balance (0)
Thread B reads balance (0)     <- both read before either writes
Thread A writes 0 + 100 = 100
Thread B writes 0 + 100 = 100  <- lost update! should be 200
```

The window where shared data is accessed is the **critical section**. Correct synchronization must guarantee:

1. **Mutual exclusion** - only one thread in the critical section at a time.
2. **Progress** - if no one is inside, a waiting thread can enter.
3. **Bounded waiting** - no thread waits forever (no starvation).

### Synchronization primitives

| Primitive | What it is | Use it for |
|-----------|-----------|------------|
| **Mutex** | Lock owned by one thread at a time | Protecting a critical section |
| **Semaphore** | Counter with `wait()`/`signal()` | Limiting access to N resources; signaling |
| **Binary semaphore** | Semaphore with count 0/1 | Similar to a mutex but no ownership |
| **Condition variable** | Wait until a condition is signaled | Producer/consumer, "wait until queue non-empty" |
| **Spinlock** | Busy-waits in a loop instead of sleeping | Very short critical sections on multicore |

**Mutex vs Semaphore** (a favorite interview question):
- A **mutex** has **ownership** - only the thread that locked it can unlock it. It's a locking mechanism.
- A **semaphore** is a **signaling mechanism** with a count - any thread can signal. A counting semaphore of N lets up to N threads through.

```
Semaphore (count = 2):  allows 2 concurrent, e.g. a connection pool
   wait()  -> count 2->1  (enter)
   wait()  -> count 1->0  (enter)
   wait()  -> BLOCKS      (pool exhausted)
   signal()-> count 0->1  (one slot freed, a waiter wakes)
```

> **Mutex vs Spinlock:** A mutex puts the waiting thread to sleep (good if the wait is long - frees the CPU). A spinlock burns CPU cycles polling (good only if the critical section is shorter than a context switch would cost).

---

## Deadlocks

A **deadlock** is when a set of processes are each waiting for a resource held by another - forever. Think two people trying to pass in a hallway, each stepping the same way repeatedly.

```
Thread 1 holds Lock A, wants Lock B
Thread 2 holds Lock B, wants Lock A

   T1 --holds--> [A]        [B] <--holds-- T2
   T1 --wants--> [B]        [A] <--wants-- T2
                  \_____ circular wait _____/
```

### The four Coffman conditions

A deadlock can occur **only if all four** hold simultaneously:

1. **Mutual exclusion** - a resource is held in a non-shareable mode.
2. **Hold and wait** - a process holds one resource while waiting for another.
3. **No preemption** - resources can't be forcibly taken away.
4. **Circular wait** - a cycle of processes each waiting on the next.

### Handling deadlocks

| Strategy | Approach |
|----------|----------|
| **Prevention** | Break one of the four conditions (e.g. acquire all locks at once, or impose a global lock ordering to kill circular wait) |
| **Avoidance** | Use info about future requests to stay in a safe state (**Banker's algorithm**) |
| **Detection & recovery** | Let deadlocks happen, detect cycles in the resource-allocation graph, then kill/rollback a process |
| **Ignore it** | The "ostrich algorithm" - most general-purpose OSes do this, since deadlocks are rare and prevention is costly |

> **Practical prevention:** The most common real-world fix is **lock ordering** - always acquire locks in a consistent global order. If every thread grabs A before B, you can never get the T1-holds-A-wants-B / T2-holds-B-wants-A cycle.

**Deadlock vs Livelock vs Starvation:**
- **Deadlock** - processes are stuck, doing nothing.
- **Livelock** - processes keep changing state in response to each other but make no progress (the hallway dance).
- **Starvation** - a process waits indefinitely because others keep getting preferred (fixed by aging).

---

## Memory Management

The OS gives each process a private, contiguous-looking **virtual address space**, even though physical RAM is limited and shared. A typical process layout:

```
High addresses
  +--------------------+
  |       Stack        |  <- grows down (local vars, call frames)
  |         |          |
  |         v          |
  |                    |
  |         ^          |
  |         |          |
  |       Heap         |  <- grows up (malloc/new)
  +--------------------+
  |   BSS / Data       |  <- global & static variables
  +--------------------+
  |       Text         |  <- program code (read-only)
  +--------------------+
Low addresses
```

**Contiguous allocation** (early systems) suffers from **fragmentation**:
- **External fragmentation** - free memory exists but in scattered small chunks, none big enough.
- **Internal fragmentation** - allocated block is bigger than requested; the leftover inside is wasted.

Paging (next section) solves external fragmentation by removing the need for contiguous physical memory.

---

## Virtual Memory & Paging

**Virtual memory** lets a process use more memory than physically exists and keeps processes isolated. The trick: split memory into fixed-size blocks.

- Virtual memory is divided into **pages** (typically 4 KB).
- Physical memory is divided into **frames** of the same size.
- A **page table** maps virtual pages → physical frames.

```
Virtual Address
+----------------+-------------+
|  Page Number   |   Offset    |
+----------------+-------------+
        |
        | look up in page table
        v
+----------------+-------------+
|  Frame Number  |   Offset    |   = Physical Address
+----------------+-------------+
```

Because pages can live in any free frame, physical memory needn't be contiguous - external fragmentation disappears.

### The TLB

Walking the page table on every memory access would be slow (it lives in RAM). The **Translation Lookaside Buffer (TLB)** is a small, fast cache of recent virtual→physical translations inside the CPU.

```
CPU needs virtual address ->
    TLB hit?  --yes--> get frame instantly (fast path)
              --no --> walk page table in RAM, then cache it (slow path)
```

### Demand paging & page faults

Pages are loaded into RAM only when accessed. When a process touches a page that isn't in RAM, the hardware raises a **page fault**:

```
1. CPU accesses a page not in memory -> page fault (trap to kernel)
2. OS finds the page on disk (in the swap area / file)
3. OS picks a free frame (or evicts one - see replacement)
4. OS loads the page into the frame, updates the page table
5. Instruction is restarted - now it succeeds
```

> **Thrashing:** If processes collectively need more active pages than fit in RAM, the OS spends almost all its time swapping pages in and out instead of doing work. Throughput collapses. The fix: reduce the degree of multiprogramming (run fewer processes) or add RAM. The **working set model** - keeping each process's recently-used pages resident - is how the OS avoids it.

---

## Page Replacement Algorithms

When a page fault occurs and no frame is free, the OS must evict a page. The goal is to evict one that won't be needed soon.

| Algorithm | Idea | Notes |
|-----------|------|-------|
| **Optimal (OPT)** | Evict the page used furthest in the future | Theoretical best; impossible to implement (needs the future) - used as a benchmark |
| **FIFO** | Evict the oldest loaded page | Simple; suffers **Belady's anomaly** (more frames can cause *more* faults) |
| **LRU** | Evict the least recently used page | Good approximation of OPT; expensive to track exactly |
| **Clock (Second Chance)** | FIFO + a reference bit; give recently-used pages a second chance | Cheap, practical approximation of LRU |

**LRU intuition** - the recent past predicts the near future:

```
Reference string: 1 2 3 1 2 4   (3 frames)

Access 1 -> [1]
Access 2 -> [1 2]
Access 3 -> [1 2 3]
Access 1 -> [1 2 3]        (hit, 1 now most-recent)
Access 2 -> [1 2 3]        (hit)
Access 4 -> [1 2 4]        (evict 3 - least recently used)
```

> **Belady's anomaly** is a classic gotcha: with FIFO, giving a process *more* frames can sometimes *increase* the number of page faults. LRU and OPT are "stack algorithms" and never suffer this.

---

## File Systems

A file system organizes bytes on disk into named files and directories, and tracks where each file's data physically lives.

### Key structures

- **inode** - a per-file metadata record: size, permissions, owner, timestamps, and pointers to the data blocks. Notably, the inode does **not** store the file name - the name lives in the directory entry.
- **Directory** - a table mapping file names → inode numbers.
- **Data blocks** - the actual file contents on disk.
- **Superblock** - filesystem-wide metadata (size, block size, free-block info).

```
Directory entry            inode                     Data blocks
+-------------+-----+     +------------------+       +--------+
| "report.txt"| 42  |---> | inode 42         |       | block  |
+-------------+-----+     |  size, perms     |-----> | block  |
                          |  block pointers -+-----> | block  |
                          +------------------+       +--------+
```

### How files map to blocks

| Method | How | Trade-off |
|--------|-----|-----------|
| **Contiguous** | File in consecutive blocks | Fast reads; external fragmentation |
| **Linked** | Each block points to the next | No fragmentation; bad random access |
| **Indexed (inode)** | An index block lists all data blocks | Good random access; used by ext4, etc. |

### Hard links vs Soft (symbolic) links

- **Hard link** - another directory entry pointing to the **same inode**. The file's data survives until the last hard link is removed (link count hits 0). Can't cross filesystems.
- **Soft link** - a special file containing a **path** to another file. If the target is deleted, the link dangles. Can cross filesystems and link directories.

### Journaling

A **journaling file system** (ext4, NTFS) first writes intended changes to a journal (log), then applies them. If the machine crashes mid-write, the OS replays the journal on reboot instead of scanning the whole disk - this prevents corruption and speeds recovery.

---

## I/O & System Calls

A **system call** is how a user program requests a service from the kernel - it's the boundary between user mode and kernel mode. Examples: `read`, `write`, `open`, `fork`, `exec`, `mmap`.

```
User program calls read()
      |
      | trap (software interrupt) -> switch to kernel mode
      v
Kernel executes the read, talks to the disk driver
      |
      | data ready -> switch back to user mode
      v
read() returns to the program
```

### I/O models

| Model | Behavior |
|-------|----------|
| **Blocking** | The call waits until I/O completes; the thread sleeps |
| **Non-blocking** | The call returns immediately (with data or "would block") |
| **I/O multiplexing** | One thread watches many descriptors (`select`, `poll`, `epoll`) |
| **Asynchronous** | Start the I/O, get notified on completion (`io_uring`, AIO) |

**Why `epoll` matters:** classic `select`/`poll` scan every file descriptor on each call - O(n). `epoll` (Linux) registers descriptors once and returns only the ready ones - O(1) per event. This is what lets a single-threaded event loop (Nginx, Node.js, Redis) handle tens of thousands of concurrent connections.

### DMA

**Direct Memory Access** lets a device (disk, NIC) transfer data to/from RAM without the CPU copying every byte. The CPU sets up the transfer and gets an interrupt when it's done - freeing it for real work during large transfers.

---

## User Mode vs Kernel Mode

CPUs run in (at least) two privilege levels, enforced by hardware:

| | User mode | Kernel mode |
|---|-----------|-------------|
| **Privilege** | Restricted | Full access to hardware & all memory |
| **What runs here** | Application code | The OS kernel, drivers |
| **Instructions** | Can't run privileged ops directly | Can execute any instruction |
| **On violation** | Trap/exception → kernel handles it | — |

Your program runs in user mode. The moment it needs something privileged (disk, network, spawning a process), it makes a **system call**, which traps into kernel mode. This separation is what stops a buggy or malicious program from crashing the whole machine or reading another process's memory.

```
+----------------------+
|   User mode          |  your code, libraries
+----------------------+
        | system call (trap)
        v
+----------------------+
|   Kernel mode        |  scheduler, memory mgr, drivers
+----------------------+
```

---

## Common Interview Questions

**Q: What's the difference between a process and a thread?**
A process has its own isolated address space; threads share the address space of their process but have their own stack and registers. Threads are cheaper to create and switch between, and communicate via shared memory; processes are isolated, so a crash in one doesn't take down the others.

**Q: What happens when you run a program?**
The shell calls `fork()` to create a child process, then `exec()` to replace the child's image with the new program. The OS sets up its address space (text, data, heap, stack), loads pages on demand, and the scheduler eventually gives it CPU time. The parent typically `wait()`s for it to finish.

**Q: What is a context switch and why is it expensive?**
Saving the current process's registers/PC to its PCB and loading another's. It's pure overhead - and for a process switch, it also swaps page tables, flushes the TLB, and pollutes CPU caches, all of which the new process must pay to rebuild.

**Q: Explain virtual memory in one minute.**
Each process gets its own large virtual address space, split into pages. A page table maps virtual pages to physical frames, so physical RAM needn't be contiguous and can be smaller than the virtual space. Pages load on demand (page faults), and unused pages can be swapped to disk. The TLB caches translations to keep it fast.

**Q: Mutex vs Semaphore?**
A mutex enforces mutual exclusion and has ownership - only the locker can unlock. A semaphore is a counter used for signaling or limiting access to N resources; any thread can signal it. A binary semaphore resembles a mutex but lacks ownership semantics.

**Q: What causes a deadlock and how do you prevent it?**
It needs all four Coffman conditions: mutual exclusion, hold-and-wait, no preemption, and circular wait. Break any one to prevent it - the most practical is imposing a global lock ordering to eliminate circular wait.

**Q: What is thrashing?**
When processes collectively need more active pages than fit in RAM, the OS spends most of its time swapping pages instead of executing. Fix by reducing multiprogramming or adding memory; the working-set model keeps each process's hot pages resident to avoid it.

**Q: LRU vs FIFO for page replacement?**
FIFO evicts the oldest page and can suffer Belady's anomaly (more frames → more faults). LRU evicts the least-recently-used page, approximates the optimal algorithm well, and never suffers Belady's anomaly, but exact tracking is costly - so real systems use approximations like the Clock algorithm.

**Q: What's the difference between blocking and non-blocking I/O, and why does epoll matter?**
Blocking I/O sleeps the thread until the operation completes; non-blocking returns immediately. `epoll` lets one thread efficiently watch thousands of descriptors and wake only for ready ones (O(1) per event vs O(n) for `select`), which is the foundation of high-concurrency event-loop servers.

**Q: Zombie vs orphan process?**
A zombie has terminated but its parent hasn't reaped its exit status yet, so its PCB lingers. An orphan's parent died first, so it's re-parented to `init`/`systemd` (PID 1), which reaps it.

**Q: Hard link vs symbolic link?**
A hard link is a second directory entry pointing to the same inode (data survives until the last link is removed, can't cross filesystems). A symbolic link is a file containing a path to the target (dangles if the target is deleted, can cross filesystems and link directories).

---

*This guide covers the OS fundamentals that come up in backend, systems, and infrastructure interviews. Pair it with the [Computer Networking Interview Guide](networking-interview-guide.md) for full-stack systems coverage.*
