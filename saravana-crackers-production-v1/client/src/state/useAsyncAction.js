import {useRef, useState} from "react";

export function useAsyncAction() {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action) {
    if (lock.current) return false;
    lock.current = true;
    setPending(true);
    setError("");
    try { return await action(); }
    catch (error) { setError(error.message || "Action failed. Please try again."); return false; }
    finally { lock.current = false; setPending(false); }
  }
  return {run, pending, error};
}