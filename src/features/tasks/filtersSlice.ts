/**
 * filtersSlice
 *
 * Pure UI/query state: filters, search, sort, pagination, and the selected
 * task. Kept separate from the entity cache so re-filtering never touches task
 * data and vice versa.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DEFAULT_PAGE_SIZE } from "@/lib/config";
import type { TaskStatus, TaskType } from "./types";

export type TypeFilter = TaskType | "all";
export type StatusFilter = TaskStatus | "all";
export type SortField = "updatedAt" | "annotationCount" | "title";
export type SortDirection = "asc" | "desc";

export interface FiltersState {
  type: TypeFilter;
  status: StatusFilter;
  search: string;
  sortField: SortField;
  sortDirection: SortDirection;
  page: number;
  pageSize: number;
  selectedId: string | null;
}

const initialState: FiltersState = {
  type: "all",
  status: "all",
  search: "",
  sortField: "updatedAt",
  sortDirection: "desc",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  selectedId: null,
};

const filtersSlice = createSlice({
  name: "filters",
  initialState,
  reducers: {
    setTypeFilter(state, action: PayloadAction<TypeFilter>) {
      state.type = action.payload;
    },
    setStatusFilter(state, action: PayloadAction<StatusFilter>) {
      state.status = action.payload;
    },
    setSearch(state, action: PayloadAction<string>) {
      state.search = action.payload;
    },
    setSort(state, action: PayloadAction<{ field: SortField; direction?: SortDirection }>) {
      const { field, direction } = action.payload;
      if (direction) {
        state.sortField = field;
        state.sortDirection = direction;
      } else if (state.sortField === field) {
        // Toggle direction when clicking the active column.
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      } else {
        state.sortField = field;
        state.sortDirection = field === "title" ? "asc" : "desc";
      }
    },
    setPage(state, action: PayloadAction<number>) {
      state.page = Math.max(1, action.payload);
    },
    selectTask(state, action: PayloadAction<string | null>) {
      state.selectedId = action.payload;
    },
  },
});

export const {
  setTypeFilter,
  setStatusFilter,
  setSearch,
  setSort,
  setPage,
  selectTask,
} = filtersSlice.actions;

export default filtersSlice.reducer;
