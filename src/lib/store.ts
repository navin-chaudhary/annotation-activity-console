import { configureStore } from "@reduxjs/toolkit";
import tasksReducer from "@/features/tasks/tasksSlice";
import filtersReducer from "@/features/tasks/filtersSlice";

export const makeStore = () =>
  configureStore({
    reducer: {
      tasks: tasksReducer,
      filters: filtersReducer,
    },
  });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
