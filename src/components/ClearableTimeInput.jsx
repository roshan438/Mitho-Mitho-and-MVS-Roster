export default function ClearableTimeInput({
  value,
  onChange,
  disabled = false,
  className = "",
  wrapperClassName = "",
  clearLabel = "Clear time",
  ...props
}) {
  const handleClear = () => {
    if (disabled || !onChange) return;
    onChange({ target: { value: "" } });
  };

  return (
    <div className={`clearable-time-field ${wrapperClassName}`.trim()}>
      <input
        {...props}
        type="time"
        value={value || ""}
        onChange={onChange}
        disabled={disabled}
        className={className}
      />
      {value && !disabled ? (
        <button
          type="button"
          className="clear-time-button"
          onClick={handleClear}
          aria-label={clearLabel}
          title={clearLabel}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
