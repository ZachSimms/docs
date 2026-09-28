/**
 * @file Hand-written stand-ins for model output: what the exercise APIs return, used by the
 * unit tests, the end-to-end tests (which stub `/api/exercises/*`) and the demo recordings.
 *
 * The coding exercise is real: its reference solution passes its tests in the sandbox, and
 * `BUGGY_LINKED_LIST` fails exactly two of them.
 */

import type { CodeExercise, CodeReview, MathProblem, MathVerdict } from "@/lib/exercises/schema";

/** A Python linked-list exercise, as `/api/exercises/code/` returns it. */
export const LINKED_LIST_EXERCISE: CodeExercise = {
  id: "0b6f4a52-2f7e-4c8e-9f0e-6a1f3c2d9b11",
  title: "Singly linked list from scratch",
  summary: "Build a singly linked list with append, prepend, remove and in-place reverse.",
  brief: `You're writing the playlist engine for a tiny music player. Songs are queued in a **singly linked list**: each node knows only the next one.

### Task

Implement \`LinkedList\` in \`solution.py\` using the \`Node\` class provided:

| Method | Does |
| --- | --- |
| \`append(value)\` | adds \`value\` at the end |
| \`prepend(value)\` | adds \`value\` at the front |
| \`remove(value)\` | removes the **first** node holding \`value\`; raises \`ValueError\` if there is none |
| \`reverse()\` | reverses the list **in place** (no new nodes) |
| \`to_list()\` | returns the values, head first, as a Python list |
| \`len(ll)\` | the number of nodes |

### Rules

- Store values in \`Node\` objects linked through \`next\`. No Python list inside \`LinkedList\`.
- \`remove\` and \`reverse\` should run in $O(n)$ time and $O(1)$ extra space.

### Example

\`\`\`python
ll = LinkedList()
ll.append("b"); ll.append("c"); ll.prepend("a")
ll.to_list()   # ['a', 'b', 'c']
ll.reverse()
ll.to_list()   # ['c', 'b', 'a']
ll.remove("b")
len(ll)        # 2
\`\`\`
`,
  requirements: [
    "`LinkedList` stores its values in `Node` objects linked through `next`, with no Python list inside",
    "`append`, `prepend`, `to_list` and `len` behave as described",
    "`remove` deletes only the first match and raises `ValueError` when the value is missing",
    "`reverse` works in place in O(n) time and O(1) extra space",
  ],
  starterCode: `class Node:
    """One element of the list."""

    def __init__(self, value, next=None):
        self.value = value
        self.next = next


class LinkedList:
    """A singly linked list."""

    def __init__(self):
        self.head = None
        self.size = 0

    def append(self, value):
        # TODO: walk to the last node and link a new one after it
        raise NotImplementedError

    def prepend(self, value):
        # TODO
        raise NotImplementedError

    def remove(self, value):
        # TODO: unlink the first node holding value, or raise ValueError
        raise NotImplementedError

    def reverse(self):
        # TODO: flip every next pointer
        raise NotImplementedError

    def to_list(self):
        # TODO
        raise NotImplementedError

    def __len__(self):
        return self.size
`,
  tests: [
    {
      name: "a new list is empty",
      code: "ll = LinkedList()\nassert_equal(ll.to_list(), [])\nassert_equal(len(ll), 0)",
    },
    {
      name: "append keeps insertion order",
      code: "ll = LinkedList()\nfor v in [1, 2, 3]:\n    ll.append(v)\nassert_equal(ll.to_list(), [1, 2, 3])\nassert_equal(len(ll), 3)",
    },
    {
      name: "prepend adds to the front",
      code: "ll = LinkedList()\nll.append(2)\nll.prepend(1)\nll.prepend(0)\nassert_equal(ll.to_list(), [0, 1, 2])",
    },
    {
      name: "values live in linked Node objects",
      code: "ll = LinkedList()\nll.append('a')\nll.append('b')\nassert_true(isinstance(ll.head, Node), 'head should be a Node')\nassert_equal(ll.head.next.value, 'b')\nassert_equal(ll.head.next.next, None)",
    },
    {
      name: "remove the head",
      code: "ll = LinkedList()\nfor v in 'abc':\n    ll.append(v)\nll.remove('a')\nassert_equal(ll.to_list(), ['b', 'c'])\nassert_equal(len(ll), 2)",
    },
    {
      name: "remove only the first match",
      code: "ll = LinkedList()\nfor v in [1, 2, 3, 2]:\n    ll.append(v)\nll.remove(2)\nassert_equal(ll.to_list(), [1, 3, 2])",
    },
    {
      name: "remove a missing value raises ValueError",
      code: "ll = LinkedList()\nll.append(1)\nassert_raises(ValueError, ll.remove, 9)\nassert_raises(ValueError, LinkedList().remove, 1)",
    },
    {
      name: "reverse in place",
      code: "ll = LinkedList()\nfor v in [1, 2, 3, 4]:\n    ll.append(v)\nnodes = [ll.head, ll.head.next]\nll.reverse()\nassert_equal(ll.to_list(), [4, 3, 2, 1])\nassert_true(ll.head.next.next.next is nodes[0], 'reverse should reuse the nodes')",
    },
    {
      name: "reverse an empty and a one-node list",
      code: "empty = LinkedList()\nempty.reverse()\nassert_equal(empty.to_list(), [])\none = LinkedList()\none.append(7)\none.reverse()\nassert_equal(one.to_list(), [7])",
    },
  ],
  hints: [
    "Keep a `size` counter up to date in every method that adds or removes a node.",
    "For `remove`, handle the head separately, then walk with a `prev` pointer so you can do `prev.next = prev.next.next`.",
    "For `reverse`, walk the list with three pointers: `prev`, `current` and `next`.",
  ],
  solution: `class Node:
    """One element of the list."""

    def __init__(self, value, next=None):
        self.value = value
        self.next = next


class LinkedList:
    """A singly linked list."""

    def __init__(self):
        self.head = None
        self.size = 0

    def append(self, value):
        node = Node(value)
        if self.head is None:
            self.head = node
        else:
            current = self.head
            while current.next:
                current = current.next
            current.next = node
        self.size += 1

    def prepend(self, value):
        self.head = Node(value, self.head)
        self.size += 1

    def remove(self, value):
        prev, current = None, self.head
        while current and current.value != value:
            prev, current = current, current.next
        if current is None:
            raise ValueError(f"{value!r} is not in the list")
        if prev is None:
            self.head = current.next
        else:
            prev.next = current.next
        self.size -= 1

    def reverse(self):
        prev, current = None, self.head
        while current:
            current.next, prev, current = prev, current, current.next
        self.head = prev

    def to_list(self):
        values, current = [], self.head
        while current:
            values.append(current.value)
            current = current.next
        return values

    def __len__(self):
        return self.size
`,
  concepts: ["linked lists", "classes", "pointers"],
  language: "python",
  difficulty: "intermediate",
  theme: "linked-lists",
  size: "exercise",
  request: "I need to practice linked lists",
  model: "poolside/laguna-s-2.1-free",
  createdAt: "2026-09-28T12:00:00.000Z",
};

/** A first attempt with two bugs: `remove` forgets the head, `reverse` forgets to move it. */
export const BUGGY_LINKED_LIST = LINKED_LIST_EXERCISE.solution
  .replace(
    `        if prev is None:
            self.head = current.next
        else:
            prev.next = current.next`,
    `        prev.next = current.next`,
  )
  .replace(
    `            current.next, prev, current = prev, current, current.next
        self.head = prev`,
    `            current.next, prev, current = prev, current, current.next`,
  );

/** The same exercise with a wrong expected value in one test (for the repair flow). */
export const BROKEN_LINKED_LIST_EXERCISE: CodeExercise = {
  ...LINKED_LIST_EXERCISE,
  tests: LINKED_LIST_EXERCISE.tests.map((t) =>
    t.name === "prepend adds to the front"
      ? { ...t, code: t.code.replace("[0, 1, 2]", "[1, 0, 2]") }
      : t,
  ),
};

/** A passing review of the fixed code. */
export const PASSING_REVIEW: CodeReview = {
  verdict: "pass",
  summary: "Every test passes and each requirement is met: a clean, idiomatic linked list.",
  requirements: [
    {
      requirement: LINKED_LIST_EXERCISE.requirements[0],
      met: true,
      note: "Nodes are linked through next (lines 16-24); no list is kept.",
    },
    { requirement: LINKED_LIST_EXERCISE.requirements[1], met: true, note: "" },
    {
      requirement: LINKED_LIST_EXERCISE.requirements[2],
      met: true,
      note: "The prev pointer handles the head on lines 33-36.",
    },
    {
      requirement: LINKED_LIST_EXERCISE.requirements[3],
      met: true,
      note: "Three pointers, one pass, no new nodes (lines 40-43).",
    },
  ],
  feedback: `**Good:** \`remove\` walks once with \`prev\`/\`current\` and treats the head as a special case, and \`reverse\` reuses the nodes, as required.

**To go further:** \`append\` is $O(n)$ because it walks to the end. Keep a \`tail\` pointer to make it $O(1)$, and remember to update it in \`remove\` and \`reverse\`.`,
};

/** A quadratic with two roots, checked locally. */
export const QUADRATIC_PROBLEM: MathProblem = {
  id: "9f1c1c3e-4b1d-4a53-8f36-2f0b8c7e5a21",
  title: "Roots of a quadratic by factoring",
  statement: `Solve for $x$ by factoring:

$$x^2 + x - 6 = 0$$`,
  answerFormat: "both solutions, comma-separated (e.g. x = 1, x = 4)",
  answer: { kind: "numeric", display: "x = 2,\\ x = -3", values: [2, -3], tolerance: 0 },
  hints: [
    "Look for two numbers whose product is $-6$ and whose sum is $1$.",
    "$3 \\cdot (-2) = -6$ and $3 + (-2) = 1$, so $x^2 + x - 6 = (x + 3)(x - 2)$.",
  ],
  solution: `Find two numbers with product $-6$ and sum $1$: $3$ and $-2$. So

$$x^2 + x - 6 = (x + 3)(x - 2) = 0.$$

A product is zero when a factor is zero: $x + 3 = 0$ or $x - 2 = 0$, so $x = -3$ or $x = 2$.

**Answer:** $x = 2,\\ x = -3$.`,
  concepts: ["quadratics", "factoring"],
  area: "equations",
  difficulty: "beginner",
  request: "solving quadratics by factoring",
  model: "poolside/laguna-s-2.1-free",
  createdAt: "2026-09-28T12:00:00.000Z",
};

/** The model explaining a sign slip. */
export const SIGN_SLIP_VERDICT: MathVerdict = {
  correct: false,
  feedback: `Your factoring step is right, $(x + 3)(x - 2) = 0$, but the next line solves $x + 3 = 0$ as $x = 3$. Moving $3$ to the other side changes its sign. Redo that step and check both roots by substituting them back into $x^2 + x - 6$.`,
};

/** A JavaScript exercise: runs in the sandbox with no download, for the default e2e path. */
export const STACK_EXERCISE: CodeExercise = {
  id: "5c0d7a1e-8b3f-4e21-a9d4-3f6b2c1e0a77",
  title: "Undo stack",
  summary: "Write a Stack class with push, pop, peek and size.",
  brief: `An editor keeps its undo history on a **stack**.

### Task

Export a class \`Stack\` from \`solution.js\` with \`push(value)\`, \`pop()\`, \`peek()\` and a \`size\` getter. \`pop()\` and \`peek()\` on an empty stack throw a \`RangeError\`.`,
  requirements: ["`Stack` is an exported class", "`pop` and `peek` throw `RangeError` when empty"],
  starterCode: `export class Stack {
  push(value) {
    throw new Error("not implemented");
  }

  pop() {
    throw new Error("not implemented");
  }

  peek() {
    throw new Error("not implemented");
  }

  get size() {
    throw new Error("not implemented");
  }
}
`,
  tests: [
    {
      name: "push then pop returns the last value",
      code: "const s = new Stack(); s.push(1); s.push(2); assertEqual(s.pop(), 2); assertEqual(s.pop(), 1);",
    },
    {
      name: "peek leaves the value",
      code: "const s = new Stack(); s.push('a'); assertEqual(s.peek(), 'a'); assertEqual(s.size, 1);",
    },
    {
      name: "size counts values",
      code: "const s = new Stack(); for (const v of [1, 2, 3]) s.push(v); assertEqual(s.size, 3);",
    },
    {
      name: "pop on an empty stack throws RangeError",
      code: "assertThrows(() => new Stack().pop(), RangeError);",
    },
  ],
  hints: ["Keep the values in a private array field."],
  solution: `export class Stack {
  #items = [];

  push(value) {
    this.#items.push(value);
  }

  pop() {
    if (this.#items.length === 0) throw new RangeError("the stack is empty");
    return this.#items.pop();
  }

  peek() {
    if (this.#items.length === 0) throw new RangeError("the stack is empty");
    return this.#items.at(-1);
  }

  get size() {
    return this.#items.length;
  }
}
`,
  concepts: ["classes", "stacks"],
  language: "javascript",
  difficulty: "beginner",
  theme: "stacks-queues",
  size: "exercise",
  request: "",
  model: "poolside/laguna-s-2.1-free",
  createdAt: "2026-09-28T12:00:00.000Z",
};
