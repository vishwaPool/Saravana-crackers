import {useRef, useState} from "react";

// Keep the lock synchronous so repeated clicks/Enter cannot submit twice.
export default function ActionForm({onSubmit, children, successMessage = "Saved successfully.", ...props}) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    setMessage("");
    setError("");
    for (const field of form.elements) {
      if (!field.willValidate) continue;
      field.setCustomValidity(field.required && !field.value.trim() ? "Please fill in this required field." : "");
    }
    if (!form.reportValidity()) {
      setError("Please complete the required fields and correct the highlighted values.");
      return;
    }
    lock.current = true;
    setPending(true);
    try {
      const result = await onSubmit(event);
      if (result !== false) setMessage(successMessage);
    } catch (error) {
      setError(error.message || "Unable to save. Please try again.");
    } finally {
      lock.current = false;
      setPending(false);
    }
  }

  return <form {...props} noValidate onSubmit={submit} aria-busy={pending}
    onInput={event => { event.target.setCustomValidity?.(""); setMessage(""); }}>
    <fieldset className="action-fields" disabled={pending}>{children}</fieldset>
    {pending && <p role="status">Processing, please wait...</p>}
    {error && <div className="alert" role="alert">{error}</div>}
    {message && <div className="success-message" role="status">{message}</div>}
  </form>;
}
