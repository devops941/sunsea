import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  FaTimes, 
  FaEquals, 
  FaBackspace, 
  FaCopy, 
  FaCheck, 
  FaHistory, 
  FaPercent, 
  FaCalculator 
} from "react-icons/fa";

interface CalculatorProps {
  onClose: () => void;
}

type CalcOp = "+" | "-" | "*" | "/" | null;

interface HistoryItem {
  expression: string;
  result: string;
  timestamp: string;
}

const Calculator: React.FC<CalculatorProps> = ({ onClose }) => {
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [op, setOp] = useState<CalcOp>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [expression, setExpression] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeBtnKey, setActiveBtnKey] = useState<string | null>(null);

  // Dragging state
  const [pos, setPos] = useState({ 
    x: Math.max(20, Math.min(window.innerWidth - 410, window.innerWidth / 2 - 192)), 
    y: Math.max(20, Math.min(window.innerHeight - 560, window.innerHeight / 2 - 270)) 
  });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const flashBtn = (key: string) => {
    setActiveBtnKey(key);
    setTimeout(() => setActiveBtnKey(null), 150);
  };

  // ── Core calculation logic ─────────────────────────────────────
  const calculate = useCallback((a: number, operator: CalcOp, b: number): number => {
    switch (operator) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b !== 0 ? a / b : 0;
      default:  return b;
    }
  }, []);

  const handleDigit = useCallback((digit: string) => {
    flashBtn(digit);
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay((prev) => {
        if (prev === "0") return digit;
        if (prev.length >= 15) return prev;
        return prev + digit;
      });
    }
  }, [waitingForOperand]);

  const handleDecimal = useCallback(() => {
    flashBtn(".");
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay((prev) => prev + ".");
  }, [waitingForOperand, display]);

  const handleOperator = useCallback((nextOp: CalcOp) => {
    if (nextOp) flashBtn(nextOp);
    const curr = parseFloat(display);
    if (prevValue !== null && op && !waitingForOperand) {
      const result = calculate(prevValue, op, curr);
      const fmt = parseFloat(result.toPrecision(12)).toString();
      setDisplay(fmt);
      setExpression(`${fmt} ${nextOp === "*" ? "×" : nextOp === "/" ? "÷" : nextOp === "-" ? "−" : "+"}`);
      setPrevValue(result);
    } else {
      const opSym = nextOp === "*" ? "×" : nextOp === "/" ? "÷" : nextOp === "-" ? "−" : "+";
      setExpression(`${display} ${opSym}`);
      setPrevValue(curr);
    }
    setOp(nextOp);
    setWaitingForOperand(true);
  }, [display, prevValue, op, waitingForOperand, calculate]);

  const handleEquals = useCallback(() => {
    flashBtn("=");
    if (prevValue === null || op === null) return;
    const curr = parseFloat(display);
    const result = calculate(prevValue, op, curr);
    const fmt = parseFloat(result.toPrecision(12)).toString();
    const fullExpr = `${expression} ${curr}`;
    
    // Add to calculation history
    setHistory((prev) => [
      {
        expression: fullExpr,
        result: fmt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev.slice(0, 19)
    ]);

    setExpression(`${fullExpr} =`);
    setDisplay(fmt);
    setPrevValue(null);
    setOp(null);
    setWaitingForOperand(true);
  }, [prevValue, op, display, expression, calculate]);

  const handleClear = useCallback(() => {
    flashBtn("C");
    setDisplay("0");
    setPrevValue(null);
    setOp(null);
    setWaitingForOperand(false);
    setExpression("");
  }, []);

  const handleBackspace = useCallback(() => {
    flashBtn("Backspace");
    if (waitingForOperand) return;
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }, [waitingForOperand]);

  const handlePercent = useCallback(() => {
    flashBtn("%");
    const curr = parseFloat(display);
    if (prevValue !== null && op) {
      // e.g. 1000 + 18% = 1000 + (1000 * 0.18)
      const percentVal = (prevValue * curr) / 100;
      setDisplay(String(parseFloat(percentVal.toPrecision(12))));
    } else {
      setDisplay((prev) => String(parseFloat(prev) / 100));
    }
  }, [display, prevValue, op]);

  // Quick GST Calculation
  const handleQuickGST = useCallback((rate: number) => {
    flashBtn(`GST${rate}`);
    const curr = parseFloat(display);
    if (isNaN(curr) || curr === 0) return;
    const gstAmount = (curr * rate) / 100;
    const total = curr + gstAmount;
    const fmt = parseFloat(total.toPrecision(12)).toString();
    setExpression(`${curr} + ${rate}% GST =`);
    
    setHistory((prev) => [
      {
        expression: `${curr} + ${rate}% GST (${gstAmount.toFixed(2)})`,
        result: fmt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      },
      ...prev.slice(0, 19)
    ]);

    setDisplay(fmt);
    setPrevValue(null);
    setOp(null);
    setWaitingForOperand(true);
  }, [display]);

  const handleToggleSign = useCallback(() => {
    flashBtn("+/-");
    setDisplay((prev) => String(parseFloat(prev) * -1));
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [display]);

  // ── Keyboard support ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { 
        e.preventDefault();
        onClose(); 
        return; 
      }
      if (e.key >= "0" && e.key <= "9") { 
        e.preventDefault();
        handleDigit(e.key); 
        return; 
      }
      if (e.key === ".") { 
        e.preventDefault();
        handleDecimal(); 
        return; 
      }
      if (e.key === "+" || e.key === "-" || e.key === "*" || e.key === "/") {
        e.preventDefault();
        handleOperator(e.key as CalcOp);
        return;
      }
      if (e.key === "Enter" || e.key === "=") { 
        e.preventDefault();
        handleEquals(); 
        return; 
      }
      if (e.key === "Backspace") { 
        e.preventDefault();
        handleBackspace(); 
        return; 
      }
      if (e.key === "%") {
        e.preventDefault();
        handlePercent();
        return;
      }
      if (e.key === "Delete" || e.key === "c" || e.key === "C") { 
        e.preventDefault();
        handleClear(); 
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleDigit, handleDecimal, handleOperator, handleEquals, handleBackspace, handleClear, handlePercent, onClose]);

  // ── Drag handlers ──────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({
        x: Math.max(10, Math.min(e.clientX - dragOffset.current.x, window.innerWidth - 390)),
        y: Math.max(10, Math.min(e.clientY - dragOffset.current.y, window.innerHeight - 560)),
      });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Format display numbers with locale commas (excluding trailing decimal typing)
  const formatDisplay = (numStr: string) => {
    if (!numStr) return "0";
    if (numStr === "Infinity" || numStr === "NaN") return numStr;
    const parts = numStr.split(".");
    const integerPart = parts[0];
    const decimalPart = parts[1];
    
    // Add commas to integer part
    const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return decimalPart !== undefined ? `${formattedInt}.${decimalPart}` : formattedInt;
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-[300] select-none drop-shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      style={{ left: pos.x, top: pos.y, width: 380 }}
    >
      {/* Outer Shell with Glassmorphism & Subtle Glow */}
      <div className="rounded-3xl overflow-hidden shadow-2xl border border-slate-700/80 bg-slate-900/95 backdrop-blur-xl text-white flex flex-col ring-1 ring-white/10">

        {/* ── 1. HEADER / DRAGGABLE TITLE BAR ── */}
        <div
          className="flex items-center justify-between px-3.5 py-2.5 bg-slate-950/80 border-b border-slate-800/80 cursor-grab active:cursor-grabbing transition-colors hover:bg-slate-950"
          onMouseDown={onMouseDown}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs shadow-inner">
              <FaCalculator />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[12px] font-black tracking-wide text-white uppercase flex items-center gap-1.5">
                Quick Calculator
              </span>
              <span className="text-[9px] font-semibold text-slate-400 font-mono">Alt+C</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* History Toggle */}
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              title="Calculation History"
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all cursor-pointer ${
                showHistory 
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30" 
                  : "bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700"
              }`}
            >
              <FaHistory className="text-[10px]" />
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close (Esc)"
              className="w-7 h-7 rounded-lg bg-rose-500/15 hover:bg-rose-500 text-rose-400 hover:text-white flex items-center justify-center text-xs transition-all cursor-pointer"
            >
              <FaTimes className="text-[11px]" />
            </button>
          </div>
        </div>

        {/* ── 2. CALCULATION HISTORY DRAWER (Collapsible) ── */}
        {showHistory && (
          <div className="bg-slate-950/90 border-b border-slate-800 p-2.5 max-h-40 overflow-y-auto custom-scrollbar animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Recent Calculations</span>
              {history.length > 0 && (
                <button 
                  onClick={() => setHistory([])}
                  className="text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-3">No history yet</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((h, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setDisplay(h.result);
                      setWaitingForOperand(true);
                    }}
                    className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-teal-500/10 hover:border-teal-500/30 border border-slate-800/60 transition-all cursor-pointer group text-right"
                  >
                    <div className="text-[10px] text-slate-400 font-mono truncate group-hover:text-teal-300">{h.expression}</div>
                    <div className="text-xs font-black text-white font-mono group-hover:text-teal-400">{h.result}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 3. DIGITAL DISPLAY SCREEN ── */}
        <div className="px-5 py-4 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/90 border-b border-slate-800/80 relative group">
          {/* Top Expression Row */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono h-5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400/80 bg-teal-500/10 px-1.5 py-0.5 rounded">
              {op ? `OP: ${op === "*" ? "×" : op === "/" ? "÷" : op === "-" ? "−" : "+"}` : "READY"}
            </span>
            <span className="truncate max-w-[260px] text-right text-slate-400 font-semibold">
              {expression || "\u00a0"}
            </span>
          </div>

          {/* Main Large Digits */}
          <div className="flex items-end justify-between gap-3 pt-1">
            {/* Quick Copy Button */}
            <button
              type="button"
              onClick={handleCopy}
              title="Copy Result"
              className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 mb-0.5 ${
                copied 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm" 
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-teal-300 border-slate-700/60 shadow-xs"
              }`}
            >
              {copied ? <FaCheck className="text-xs" /> : <FaCopy className="text-xs" />}
            </button>

            {/* Formatted Number Display */}
            <div 
              className="text-4xl font-black font-mono text-right tracking-tight text-white truncate leading-none flex-1 text-glow"
              title={display}
            >
              {formatDisplay(display)}
            </div>
          </div>
        </div>

        {/* ── 4. QUICK GST PRESET BUTTONS (SUPER USEFUL FOR ERP) ── */}
        <div className="grid grid-cols-4 gap-1.5 px-4 pt-2.5 pb-2 bg-slate-900/60 border-b border-slate-800/60">
          {[5, 12, 18, 28].map((gst) => (
            <button
              key={gst}
              type="button"
              onClick={() => handleQuickGST(gst)}
              className={`py-1.5 rounded-lg text-[11px] font-black tracking-wide border transition-all cursor-pointer ${
                activeBtnKey === `GST${gst}`
                  ? "bg-teal-500 text-white border-teal-400 scale-95 shadow-md"
                  : "bg-slate-800/70 hover:bg-teal-500/20 text-teal-400 hover:text-teal-300 border-teal-500/25 shadow-2xs"
              }`}
            >
              +{gst}% GST
            </button>
          ))}
        </div>

        {/* ── 5. MODERN KEYPAD GRID ── */}
        <div className="grid grid-cols-4 gap-2.5 p-4 bg-slate-900/80">
          {/* Row 1: AC, +/-, %, ÷ */}
          <button
            type="button"
            onClick={handleClear}
            className={`py-3.5 rounded-2xl text-sm font-black text-rose-400 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition-all active:scale-95 cursor-pointer shadow-xs ${
              activeBtnKey === "C" ? "scale-95 bg-rose-500 text-white" : ""
            }`}
          >
            AC
          </button>

          <button
            type="button"
            onClick={handleToggleSign}
            className={`py-3.5 rounded-2xl text-sm font-black text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all active:scale-95 cursor-pointer shadow-xs ${
              activeBtnKey === "+/-" ? "scale-95 bg-slate-600 text-white" : ""
            }`}
          >
            ±
          </button>

          <button
            type="button"
            onClick={handlePercent}
            className={`py-3.5 rounded-2xl text-sm font-black text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 transition-all active:scale-95 cursor-pointer shadow-xs ${
              activeBtnKey === "%" ? "scale-95 bg-slate-600 text-white" : ""
            }`}
          >
            %
          </button>

          <button
            type="button"
            onClick={() => handleOperator("/")}
            className={`py-3.5 rounded-2xl text-xl font-black text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-all active:scale-95 cursor-pointer shadow-xs ${
              op === "/" || activeBtnKey === "/" ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20" : ""
            }`}
          >
            ÷
          </button>

          {/* Row 2: 7, 8, 9, × */}
          <button
            type="button"
            onClick={() => handleDigit("7")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "7" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit("8")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "8" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit("9")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "9" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleOperator("*")}
            className={`py-3.5 rounded-2xl text-xl font-black text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-all active:scale-95 cursor-pointer shadow-xs ${
              op === "*" || activeBtnKey === "*" ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20" : ""
            }`}
          >
            ×
          </button>

          {/* Row 3: 4, 5, 6, − */}
          <button
            type="button"
            onClick={() => handleDigit("4")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "4" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit("5")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "5" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit("6")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "6" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleOperator("-")}
            className={`py-3.5 rounded-2xl text-xl font-black text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-all active:scale-95 cursor-pointer shadow-xs ${
              op === "-" || activeBtnKey === "-" ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20" : ""
            }`}
          >
            −
          </button>

          {/* Row 4: 1, 2, 3, + */}
          <button
            type="button"
            onClick={() => handleDigit("1")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "1" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit("2")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "2" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit("3")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "3" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleOperator("+")}
            className={`py-3.5 rounded-2xl text-xl font-black text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-all active:scale-95 cursor-pointer shadow-xs ${
              op === "+" || activeBtnKey === "+" ? "bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20" : ""
            }`}
          >
            +
          </button>

          {/* Row 5: Backspace, 0, ., = */}
          <button
            type="button"
            onClick={handleBackspace}
            title="Backspace"
            className={`py-3.5 rounded-2xl text-sm font-bold text-slate-300 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-xs ${
              activeBtnKey === "Backspace" ? "scale-95 bg-slate-600 text-white" : ""
            }`}
          >
            <FaBackspace className="text-base" />
          </button>

          <button
            type="button"
            onClick={() => handleDigit("0")}
            className={`py-3.5 rounded-2xl text-base font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "0" ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDecimal}
            className={`py-3.5 rounded-2xl text-base font-black text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/70 shadow-xs transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "." ? "scale-95 bg-teal-600 border-teal-400" : ""
            }`}
          >
            .
          </button>

          <button
            type="button"
            onClick={handleEquals}
            className={`py-3.5 rounded-2xl text-sm font-black text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 border border-emerald-400/50 shadow-lg shadow-emerald-500/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              activeBtnKey === "=" ? "scale-95 ring-2 ring-emerald-300" : ""
            }`}
          >
            <FaEquals className="text-sm" />
          </button>
        </div>

        {/* ── 6. FOOTER HINT ── */}
        <div className="px-3.5 py-2 bg-slate-950/80 border-t border-slate-800/60 flex items-center justify-between text-[9.5px] text-slate-500 font-mono">
          <span>⌨️ ESC close · Enter result</span>
          <span>🖱️ Drag header</span>
        </div>
      </div>
    </div>
  );
};

export default Calculator;
