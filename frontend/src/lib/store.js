// src/lib/store.js
import { writable } from 'svelte/store';

// This store will hold the dataset the user picks
export const selectedDataset = writable(null);

// NEW: This store will control the modal's visibility from any component
export const isModalOpen = writable(false);