/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";

interface FormulaInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: number | undefined;
  onChange: (val: number | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowZero?: boolean;
}

export function FormulaInput({
  value,
  onChange,
  placeholder,
  className,
  disabled,
  allowZero = false,
  ...rest
}: FormulaInputProps) {
  const [localText, setLocalText] = useState<string>("");
  const [isFocused, setIsFocused] = useState(false);

  // Helper to format the value for text input
  const formatVal = (val: number | undefined) => {
    if (val === undefined || val === null) return "";
    if (val === 0) return allowZero ? "0" : "";
    return String(val);
  };

  // Sync with value when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalText(formatVal(value));
    }
  }, [value, isFocused]);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    e.currentTarget.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    
    // Clean whitespace and filter allowed characters to prevent any shell/script injection
    const clean = localText.trim().replace(/\s+/g, "").replace(/[^0-9+\-*/().]/g, "");
    
    if (!clean) {
      onChange(undefined);
      setLocalText("");
      return;
    }
    
    try {
      // Evaluate the cleaned expression securely
      const result = new Function(`return (${clean})`)();
      const num = Number(result);
      
      if (!isNaN(num) && isFinite(num)) {
        // Round to 3 decimal places to keep it clean but allow precise hours/rounds
        const finalVal = Math.max(0, Math.round(num * 1000) / 1000);
        onChange(finalVal);
        setLocalText(formatVal(finalVal));
      } else {
        // Reset to parent value on NaN / Infinity
        setLocalText(formatVal(value));
      }
    } catch (e) {
      // Reset to parent value on syntax error
      setLocalText(formatVal(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      value={localText}
      onChange={(e) => {
        let val = e.target.value;
        if (/^0+(\d)/.test(val)) {
          val = val.replace(/^0+(\d)/, "$1");
        }
        setLocalText(val);
      }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...rest}
    />
  );
}
