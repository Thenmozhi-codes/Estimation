// Global toast bus
const listeners = new Set();
export const toastBus = {
  emit(t) { listeners.forEach((fn) => fn(t)); },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export const toast = {
  success: (message) => toastBus.emit({ type: "success", message }),
  error:   (message) => toastBus.emit({ type: "error",   message }),
  info:    (message) => toastBus.emit({ type: "info",    message }),
};