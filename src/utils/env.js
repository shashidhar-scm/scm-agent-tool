export const env = (k, d = "") => {
  const v = process.env[k];
  return v == null || String(v).trim() === "" ? d : String(v);
};

export const requireEnv = (k) => {
  const v = env(k);
  if (!v) throw new Error(`${k} is required`);
  return v;
};
