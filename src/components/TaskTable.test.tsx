import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { makeStore } from "@/lib/store";
import { hydrateFromCache } from "@/features/tasks/tasksSlice";
import { normalizeTask } from "@/features/tasks/normalize";
import type { Task } from "@/features/tasks/types";
import { TaskFilters } from "./TaskFilters";
import { TaskTable } from "./TaskTable";

function seededStore() {
  const tasks = [
    normalizeTask({ id: "t1", title: "Alpha", type: "image", status: "done", updatedAt: 100 }),
    normalizeTask({ id: "t2", title: "Bravo", type: "audio", status: "todo", updatedAt: 300 }),
    normalizeTask({ id: "t3", title: "Charlie", type: "image", status: "in_progress", updatedAt: 200 }),
  ].filter((t): t is Task => t !== null);

  const store = makeStore();
  store.dispatch(
    hydrateFromCache({ tasks, meta: { page: 1, pageSize: 20, total: 3 }, savedAt: Date.now() }),
  );
  return store;
}

function renderConsole() {
  return render(
    <Provider store={seededStore()}>
      <TaskFilters />
      <TaskTable />
    </Provider>,
  );
}

describe("TaskTable filtering", () => {
  it("shows all seeded tasks initially", () => {
    renderConsole();
    expect(screen.getAllByTestId("task-row")).toHaveLength(3);
  });

  it("narrows the visible rows when filtering by type", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.selectOptions(screen.getByLabelText("Filter by type"), "image");

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
  });

  it("narrows the visible rows when searching", async () => {
    const user = userEvent.setup();
    renderConsole();

    await user.type(screen.getByLabelText("Search tasks"), "brav");

    const rows = screen.getAllByTestId("task-row");
    expect(rows).toHaveLength(1);
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });
});
