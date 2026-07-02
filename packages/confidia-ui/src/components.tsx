import React from "react";

// LcpStatusCard Component
export interface LcpStatusProps {
  domain: string;
  atrHash: string;
  jurisdiction: string;
  disputeResolution: string;
  acceptanceRequired: boolean;
  status: "verified" | "pending" | "failed";
  lang?: "en" | "es";
}

export const LcpStatusCard: React.FC<LcpStatusProps> = ({
  domain,
  atrHash,
  jurisdiction,
  disputeResolution,
  acceptanceRequired,
  status,
  lang = "en"
}) => {
  const isEs = lang === "es";
  const statusColors = {
    verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/35",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/35",
    failed: "bg-rose-500/10 text-rose-400 border-rose-500/35"
  };

  const statusText = {
    verified: isEs ? "verificado" : "verified",
    pending: isEs ? "pendiente" : "pending",
    failed: isEs ? "fallido" : "failed"
  };

  return (
    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl transition-all hover:border-slate-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-100 font-sans tracking-wide">{domain}</h3>
        <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border ${statusColors[status]}`}>
          {statusText[status]}
        </span>
      </div>
      
      <div className="space-y-3 text-sm text-slate-400">
        <div className="flex justify-between">
          <span>{isEs ? "Hash ATR:" : "ATR Hash:"}</span>
          <span className="font-mono text-slate-300 truncate max-w-[200px]" title={atrHash}>{atrHash}</span>
        </div>
        <div className="flex justify-between">
          <span>{isEs ? "Jurisdicción:" : "Jurisdiction:"}</span>
          <span className="font-semibold text-slate-200">{jurisdiction || "Global"}</span>
        </div>
        <div className="flex justify-between">
          <span>{isEs ? "Resolución de Disputas:" : "Dispute Resolution:"}</span>
          <span className="font-semibold text-slate-200">{disputeResolution || "UNCITRAL"}</span>
        </div>
        <div className="flex justify-between border-t border-slate-800/80 pt-2 mt-2">
          <span>{isEs ? "Aceptación Requerida:" : "Acceptance Required:"}</span>
          <span className="font-semibold text-slate-200">
            {acceptanceRequired ? (isEs ? "Sí" : "Yes") : (isEs ? "No" : "No")}
          </span>
        </div>
      </div>
    </div>
  );
};

// ZkProofVisualizer Component
export interface ZkProofProps {
  circuitName: string;
  publicInputs: string[];
  proofHex: string;
  isVerified: boolean;
  lang?: "en" | "es";
}

export const ZkProofVisualizer: React.FC<ZkProofProps> = ({
  circuitName,
  publicInputs,
  proofHex,
  isVerified,
  lang = "en"
}) => {
  const isEs = lang === "es";
  return (
    <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
      
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="text-sm uppercase tracking-wider font-semibold text-indigo-400 font-mono">
            {isEs ? "Circuito ZK" : "ZK Circuit"}
          </h4>
          <h3 className="text-xl font-bold text-slate-100 mt-0.5">{circuitName}</h3>
        </div>
        <div className={`px-4 py-1.5 rounded-xl border text-sm font-semibold flex items-center gap-2 ${
          isVerified 
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" 
            : "border-slate-800 bg-slate-900 text-slate-500"
        }`}>
          <span className={`w-2 h-2 rounded-full ${isVerified ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`}></span>
          {isVerified ? (isEs ? "Prueba Verificada" : "Verified Proof") : (isEs ? "Inactivo" : "Idle")}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs text-slate-500 font-mono block mb-1">
            {isEs ? "Entradas Públicas (Campos Escalares BN254):" : "Public Inputs (BN254 Scalar Fields):"}
          </span>
          <div className="bg-slate-900/80 rounded-lg p-3 max-h-[100px] overflow-y-auto border border-slate-800/60">
            {publicInputs.length > 0 ? (
              <ul className="space-y-1 font-mono text-xs text-indigo-300">
                {publicInputs.map((val, idx) => (
                  <li key={idx} className="truncate">{`[${idx}]: ${val}`}</li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-600 font-mono">{isEs ? "Ninguna" : "None"}</span>
            )}
          </div>
        </div>

        <div>
          <span className="text-xs text-slate-500 font-mono block mb-1">
            {isEs ? "Bytes de Prueba (UltraHonk):" : "Proof Bytes (UltraHonk):"}
          </span>
          <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800/60">
            <span className="font-mono text-xs text-slate-400 break-all select-all block line-clamp-2">
              {proofHex}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// TransactionTable Component
export interface TransactionItem {
  id: string;
  domain: string;
  amount: number;
  tokenType: "standard" | "confidential";
  status: string;
  atrHash: string;
  created_at: string;
}

export const TransactionTable: React.FC<{ items: TransactionItem[]; lang?: "en" | "es" }> = ({ 
  items, 
  lang = "en" 
}) => {
  const isEs = lang === "es";
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900/90 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-6 py-4">{isEs ? "ID de Transacción" : "Transaction ID"}</th>
            <th className="px-6 py-4">{isEs ? "Dominio" : "Domain"}</th>
            <th className="px-6 py-4">{isEs ? "Estándar" : "Standard"}</th>
            <th className="px-6 py-4">{isEs ? "Monto" : "Amount"}</th>
            <th className="px-6 py-4">{isEs ? "Estado" : "Status"}</th>
            <th className="px-6 py-4">{isEs ? "Fecha" : "Date"}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
          {items.length > 0 ? (
            items.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-mono text-slate-400 text-xs truncate max-w-[120px]" title={tx.id}>
                  {tx.id}
                </td>
                <td className="px-6 py-4 font-semibold text-slate-200">{tx.domain}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    tx.tokenType === "confidential" 
                      ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
                      : "bg-slate-800 text-slate-400 border-slate-700"
                  }`}>
                    {tx.tokenType === "confidential" ? "zkToken" : "SEP-41"}
                  </span>
                </td>
                <td className="px-6 py-4 font-bold text-slate-100">{tx.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    {tx.status === "Completed" ? (isEs ? "Completado" : "Completed") : tx.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs">
                  {new Date(tx.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500 font-mono">
                {isEs ? "No hay registros de transacciones disponibles." : "No transaction records available."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
