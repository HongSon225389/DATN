import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export default function AdminDialog({
  title,
  children,
  onClose,
  busy = false,
}) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";
    dialog.focus();

    return () => {
      document.body.style.overflow = previousOverflow;

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus();
      }
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();

      if (!busy) onClose();
      return;
    }

    if (event.key !== "Tab") return;

    const elements = Array.from(
      dialogRef.current.querySelectorAll(
        'a[href], button, input, select, textarea, [tabindex="0"]',
      ),
    ).filter(
      (element) => !element.disabled && element.getClientRects().length > 0,
    );

    if (elements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const current = document.activeElement;

    if (event.shiftKey) {
      if (current === first || current === dialogRef.current) {
        event.preventDefault();
        last.focus();
      }
    } else if (current === last || current === dialogRef.current) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div className="admin-dialog-overlay">
      <div
        ref={dialogRef}
        className="admin-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className="admin-dialog-heading">
          <h2 id={titleId}>{title}</h2>

          <button
            type="button"
            className="admin-dialog-close"
            disabled={busy}
            aria-label="Đóng hộp thoại"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="admin-dialog-content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
