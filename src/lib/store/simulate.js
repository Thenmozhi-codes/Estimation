export const simulate = (data, ms = 40) =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));