import { useState } from "react";
import { ClipboardCopy, Plus, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAdminEmail, useAccess } from "@/components/wfm/AccessGate";

function buildCodeSnippet(allowlist: string[], admins: string[]) {
  const others = allowlist.filter((email) => !admins.includes(email));
  const list = (items: string[]) => items.map((e) => `  "${e}",`).join("\n");
  return `// src/lib/wfm/access-list.ts\nexport const ADMIN_EMAILS = [\n${list(admins)}\n];\n\nexport const ALLOWED_EMAILS = [\n${list(others)}\n];\n`;
}

export function AccessManager() {
  const access = useAccess();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!access) return null;

  if (!access.isAdmin) {
    return (
      <section className="border-border bg-card shadow-card space-y-2 rounded-md border p-4">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide uppercase">
          <UserCog className="size-4" /> Cuentas con acceso
        </h2>
        <p className="text-muted-foreground text-xs">
          Solo los administradores pueden agregar o quitar cuentas de correo con acceso a la
          aplicación. Actualmente hay {access.allowlist.length} cuentas autorizadas.
        </p>
      </section>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = access.addEmail(value);
    if (!result.ok) {
      setError(result.error ?? "No se pudo agregar el correo.");
      return;
    }
    setError(null);
    setValue("");
  };

  return (
    <section className="border-border bg-card shadow-card space-y-4 rounded-md border p-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide uppercase">
          <UserCog className="size-4" /> Cuentas con acceso
        </h2>
        <p className="text-muted-foreground text-xs">
          Como administrador puedes agregar o quitar correos autorizados. Los administradores no
          pueden ser eliminados.
        </p>
      </div>

      <form onSubmit={submit} className="flex flex-wrap items-start gap-2">
        <div className="min-w-[240px] flex-1 space-y-1">
          <Input
            type="email"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            placeholder="nombre@telpark.com"
            aria-label="Correo a autorizar"
            aria-invalid={error ? true : undefined}
          />
          {error && (
            <p role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
        <Button type="submit">
          <Plus className="size-4" /> Agregar
        </Button>
      </form>

      <ul className="divide-border border-border divide-y rounded-sm border">
        {access.allowlist.map((email) => {
          const admin = isAdminEmail(email);
          return (
            <li key={email} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex items-center gap-2 text-xs">
                {email}
                {admin && (
                  <span className="bg-secondary-brand/15 text-foreground flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                    <ShieldCheck className="size-3" /> Administrador
                  </span>
                )}
              </span>
              {!admin && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Quitar acceso a ${email}`}
                  onClick={() => {
                    const result = access.removeEmail(email);
                    if (!result.ok) setError(result.error ?? "No se pudo quitar el correo.");
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
