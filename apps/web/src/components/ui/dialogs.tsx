"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";
import { Input } from "./input";

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
};

type AlertOpts = {
  title: string;
  message?: string;
  tone?: "info" | "error" | "success";
};

type PromptOpts = {
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
};

type DialogCtx = {
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  alert: (o: AlertOpts) => Promise<void>;
  prompt: (o: PromptOpts) => Promise<string | null>;
};

const Ctx = createContext<DialogCtx | null>(null);

export function useDialog(): DialogCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Dev-time fallback to native APIs if provider missing — keeps app usable.
    return {
      confirm: async (o) => window.confirm(`${o.title}${o.message ? "\n\n" + o.message : ""}`),
      alert: async (o) => window.alert(`${o.title}${o.message ? "\n\n" + o.message : ""}`),
      prompt: async (o) => window.prompt(o.title, o.defaultValue ?? ""),
    };
  }
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [alertState, setAlertState] = useState<(AlertOpts & { resolve: () => void }) | null>(null);
  const [promptState, setPromptState] = useState<(PromptOpts & { resolve: (v: string | null) => void }) | null>(null);
  const [promptValue, setPromptValue] = useState("");

  const confirm = useCallback(
    (o: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })),
    [],
  );
  const alert = useCallback(
    (o: AlertOpts) => new Promise<void>((resolve) => setAlertState({ ...o, resolve })),
    [],
  );
  const prompt = useCallback(
    (o: PromptOpts) => new Promise<string | null>((resolve) => {
      setPromptValue(o.defaultValue ?? "");
      setPromptState({ ...o, resolve });
    }),
    [],
  );

  return (
    <Ctx.Provider value={{ confirm, alert, prompt }}>
      {children}

      {confirmState && (
        <Shell
          onClose={() => {
            confirmState.resolve(false);
            setConfirmState(null);
          }}
        >
          <h3 className="text-lg font-semibold text-slate-900">{confirmState.title}</h3>
          {confirmState.message && <p className="text-sm text-slate-500 mt-1">{confirmState.message}</p>}
          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                confirmState.resolve(false);
                setConfirmState(null);
              }}
            >
              {confirmState.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={confirmState.variant === "destructive" ? "destructiveSolid" : "primary"}
              size="md"
              autoFocus
              onClick={() => {
                confirmState.resolve(true);
                setConfirmState(null);
              }}
            >
              {confirmState.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </Shell>
      )}

      {alertState && (
        <Shell
          onClose={() => {
            alertState.resolve();
            setAlertState(null);
          }}
        >
          <div className="flex items-start gap-3">
            <Dot tone={alertState.tone ?? "info"} />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-slate-900">{alertState.title}</h3>
              {alertState.message && <p className="text-sm text-slate-500 mt-1">{alertState.message}</p>}
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <Button
              variant="primary"
              size="md"
              autoFocus
              onClick={() => {
                alertState.resolve();
                setAlertState(null);
              }}
            >
              OK
            </Button>
          </div>
        </Shell>
      )}

      {promptState && (
        <PromptShell
          state={promptState}
          value={promptValue}
          onChange={setPromptValue}
          onCancel={() => {
            promptState.resolve(null);
            setPromptState(null);
          }}
          onSubmit={() => {
            promptState.resolve(promptValue);
            setPromptState(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function Shell({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl p-6"
      >
        {children}
      </div>
    </div>
  );
}

function PromptShell({
  state,
  value,
  onChange,
  onCancel,
  onSubmit,
}: {
  state: PromptOpts;
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <Shell onClose={onCancel}>
      <h3 className="text-lg font-semibold text-slate-900">{state.title}</h3>
      {state.message && <p className="text-sm text-slate-500 mt-1">{state.message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="mt-4 space-y-4"
      >
        <Input
          ref={inputRef}
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md">
            {state.confirmLabel ?? "OK"}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

function Dot({ tone }: { tone: "info" | "error" | "success" }) {
  const color =
    tone === "error" ? "bg-red-500" :
    tone === "success" ? "bg-emerald-500" :
    "bg-slate-400";
  return <span className={`mt-2 inline-block h-2 w-2 rounded-full ${color} shrink-0`} />;
}
