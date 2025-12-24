// FIX: Import React to make the React namespace available for type annotations like React.Dispatch.
import React, { useState, useEffect } from 'react';

// A custom hook to read and write to localStorage
export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  // State to store our value
  // Pass initial state function to useState so logic is only executed once
  const [value, setValue] = useState<T>(() => {
    // Prevent build error "window is not defined" during server-side rendering
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      // Get from local storage by key
      const item = window.localStorage.getItem(key);
      // Parse stored json or if none return initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // If error also return initialValue
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  });

  // useEffect to update local storage when the state changes
  useEffect(() => {
    // Prevent build error "window is not defined" during server-side rendering
    if (typeof window === 'undefined') {
      return;
    }

    try {
      // Save state to local storage
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }, [key, value]);

  return [value, setValue];
}