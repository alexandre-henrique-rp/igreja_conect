import { useState, useMemo } from "react";

export type AtividadeCalendario = {
  id: string;
  tipo: "CULTO" | "ENSAIO" | "ATIVIDADE_EXTRA";
  data: string;
  horario: string;
  descricao: string | null;
};

export type IndisponibilidadeCalendario = {
  id: string;
  dataInicio: string;
  dataFim: string;
  motivo: string | null;
};

type Props = {
  atividades: AtividadeCalendario[];
  indisponibilidades: IndisponibilidadeCalendario[];
  onAddAtividade: (data: string) => void;
  onAddIndisponibilidade: (data: string) => void;
  onRemoveAtividade: (id: string) => void;
  onRemoveIndisponibilidade: (id: string) => void;
};

const DIAS_HEADER = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const COR_TIPO: Record<string, string> = {
  CULTO: "bg-blue-100 text-blue-700 border-blue-300",
  ENSAIO: "bg-green-100 text-green-700 border-green-300",
  ATIVIDADE_EXTRA: "bg-purple-100 text-purple-700 border-purple-300",
};

const COR_TIPO_DOT: Record<string, string> = {
  CULTO: "bg-blue-500",
  ENSAIO: "bg-green-500",
  ATIVIDADE_EXTRA: "bg-purple-500",
};

function parseDate(s: string): Date {
  return new Date(s);
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function isWithinRange(d: Date, start: Date, end: Date): boolean {
  const dNorm = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const startNorm = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endNorm = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59);
  return dNorm >= startNorm && dNorm <= endNorm;
}

export function CalendarioDisponibilidade({
  atividades,
  indisponibilidades,
  onAddAtividade,
  onAddIndisponibilidade,
  onRemoveAtividade,
  onRemoveIndisponibilidade,
}: Props) {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);

  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const dias: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    const offset = primeiroDia.getDay();
    for (let i = 0; i < offset; i++) {
      const d = new Date(ano, mes, i - offset + 1);
      dias.push({ date: d, isCurrentMonth: false });
    }
    for (let i = 1; i <= ultimoDia.getDate(); i++) {
      dias.push({ date: new Date(ano, mes, i), isCurrentMonth: true });
    }
    const remaining = 42 - dias.length;
    for (let i = 1; i <= remaining; i++) {
      dias.push({ date: new Date(ano, mes + 1, i), isCurrentMonth: false });
    }
    return dias;
  }, [mes, ano]);

  function mesAnterior() {
    if (mes === 0) { setMes(11); setAno(ano - 1); }
    else setMes(mes - 1);
  }

  function proximoMes() {
    if (mes === 11) { setMes(0); setAno(ano + 1); }
    else setMes(mes + 1);
  }

  function getAtividadesDoDia(d: Date) {
    return atividades.filter((a) => sameDay(parseDate(a.data), d));
  }

  function getIndisponibilidadesDoDia(d: Date) {
    return indisponibilidades.filter((ind) =>
      isWithinRange(d, parseDate(ind.dataInicio), parseDate(ind.dataFim)),
    );
  }

  function formatDataISO(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return (
    <div className="w-full">
      {/* Navegação do mês */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={mesAnterior}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-800">
          {MESES[mes]} {ano}
        </span>
        <button
          type="button"
          onClick={proximoMes}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-full bg-blue-500" /> Culto
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-full bg-green-500" /> Ensaio
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-full bg-purple-500" /> Atividade Extra
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-600">
          <span className="w-3 h-3 rounded-full bg-red-400" /> Indisponível
        </span>
      </div>

      {/* Grid do calendário */}
      <div className="grid grid-cols-7 gap-1">
        {DIAS_HEADER.map((d) => (
          <div key={d} className="text-center text-xs font-bold text-slate-400 py-1">
            {d}
          </div>
        ))}
        {diasDoMes.map((diaInfo, idx) => {
          const dia = diaInfo.date;
          const atividadesDia = getAtividadesDoDia(dia);
          const indisponibilidadesDia = getIndisponibilidadesDoDia(dia);
          const temIndisponibilidade = indisponibilidadesDia.length > 0;
          const isHoje = sameDay(dia, hoje);
          const dataISO = formatDataISO(dia);

          return (
            <div
              key={idx}
              className={`min-h-[72px] border rounded-md p-1 text-xs transition-colors ${
                diaInfo.isCurrentMonth
                  ? temIndisponibilidade
                    ? "bg-red-50 border-red-200"
                    : "bg-white border-slate-200 hover:border-slate-300"
                  : "bg-slate-50 border-slate-100 text-slate-300"
              } ${isHoje ? "ring-2 ring-cyan-500" : ""}`}
              onClick={() => diaInfo.isCurrentMonth && setDiaSelecionado(diaSelecionado === dataISO ? null : dataISO)}
            >
              <div className="font-semibold text-slate-700 mb-0.5">{dia.getDate()}</div>
              <div className="space-y-0.5">
                {atividadesDia.map((a) => (
                  <div
                    key={a.id}
                    className={`px-1 py-0.5 rounded text-[10px] border cursor-pointer ${COR_TIPO[a.tipo]}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveAtividade(a.id);
                    }}
                    title={`${a.tipo === "CULTO" ? "Culto" : a.tipo === "ENSAIO" ? "Ensaio" : "Atividade Extra"} ${a.horario}${a.descricao ? " — " + a.descricao : ""}\nClique para remover`}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${COR_TIPO_DOT[a.tipo]} mr-1`} />
                    {a.horario}
                  </div>
                ))}
                {temIndisponibilidade && (
                  <div
                    className="px-1 py-0.5 rounded text-[10px] bg-red-100 text-red-600 border border-red-200 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveIndisponibilidade(indisponibilidadesDia[0].id);
                    }}
                    title={`Indisponível${indisponibilidadesDia[0].motivo ? " — " + indisponibilidadesDia[0].motivo : ""}\nClique para remover`}
                  >
                    Indisp.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel de ações do dia selecionado */}
      {diaSelecionado && (
        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-slate-700">
              {new Date(diaSelecionado + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" })}
            </span>
            <button
              type="button"
              onClick={() => setDiaSelecionado(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAddAtividade(diaSelecionado)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
            >
              + Ensaio
            </button>
            <button
              type="button"
              onClick={() => onAddAtividade(diaSelecionado)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
            >
              + Atividade Extra
            </button>
            <button
              type="button"
              onClick={() => onAddIndisponibilidade(diaSelecionado)}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
            >
              + Indisponibilidade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
