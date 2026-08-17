import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALLOWED_EMAILS = [
  "jmontalban@telpark.com",
  "m.sousa@telpark.com",
  "f.lavin@telpark.com",
  "d.viramalay@telpark.com",
  "g.medina@telpark.com",
];

const STORAGE_KEY = "wfm.access.email";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function isAllowedEmail(value: string) {
  return ALLOWED_EMAILS.includes(normalize(value));
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isAllowedEmail(stored)) setEmail(normalize(stored));
    setReady(true);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = normalize(input);
    if (!isAllowedEmail(value)) {
      setError("Este correo no tiene acceso autorizado a la aplicación.");
      return;
    }
    localStorage.setItem(STORAGE_KEY, value);
    setEmail(value);
    setError(null);
    setInput("");
  };

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setEmail(null);
  };

  if (!ready) return null;

  if (!email) {
    return (
      <div className="bg-surface text-foreground flex min-h-screen items-center justify-center px-4">
        <div className="border-border bg-card shadow-card w-full max-w-sm space-y-5 rounded-md border p-6">
          <div className="space-y-3">
            <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-sm">
              <ShieldCheck className="size-5" />
            </span>
            <div className="space-y-1">
              <h1 className="text-base font-semibold tracking-tight">Acceso restringido</h1>
              <p className="text-muted-foreground text-xs">
                Introduce tu correo corporativo autorizado para acceder al análisis de ocupación.
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <Input
              type="email"
              required
              autoFocus
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError(null);
              }}
              placeholder="nombre@telpark.com"
              aria-label="Correo corporativo"
              aria-invalid={error ? true : undefined}
            />
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              Acceder
            </Button>
          </form>

          <p className="text-muted-foreground text-[11px] leading-relaxed">
            El acceso está limitado a una lista de correos corporativos autorizados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AccessContext.Provider value={{ email, signOut }}>{children}</AccessContext.Provider>
  );
}

const AccessContext = createContext<{ email: string; signOut: () => void } | null>(null);

export function useAccess() {
  return useContext(AccessContext);
}

export function SignOutButton() {
  const access = useAccess();
  if (!access) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary-foreground/70 hidden text-xs md:inline">{access.email}</span>
      <Button variant="secondary" size="sm" onClick={access.signOut}>
        <LogOut className="size-4" /> Salir
      </Button>
    </div>
  );
}
