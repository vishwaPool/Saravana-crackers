import {useRef, useState} from "react";

export default function AsyncButton({onClick, children, disabled, successMessage = "", ...props}) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function click(event) {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await onClick(event);
      if (result !== false) setMessage(successMessage);
    } catch (error) {
      setError(error.message || "Action failed. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return <><button type="button" {...props} disabled={disabled || pending} aria-busy={pending} onClick={click}>{pending ? "Please wait..." : children}</button>
    {error && <span className="alert" role="alert">{error}</span>}
    {message && <span className="success-message" role="status">{message}</span>}</>;
}
