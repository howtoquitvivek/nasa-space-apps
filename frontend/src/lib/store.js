// src/lib/store.js
import { writable } from 'svelte/store';

// helper: persist store to localStorage
function createPersistedStore(key, initial) {
  let stored = null;
  if (typeof localStorage !== 'undefined') {
    stored = localStorage.getItem(key);
  }

  const store = writable(stored ? JSON.parse(stored) : initial);

  store.subscribe((value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  });

  return store;
}

// PERSISTED: dataset selection survives refresh
export const selectedDataset = createPersistedStore('selectedDataset', null);

// NON-PERSISTED: modal open state resets each time (keeps UI clean)
export const isModalOpen = writable(false);
