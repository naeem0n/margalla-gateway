import React, { Component, ErrorInfo, ReactNode } from "react";
import { apiFetch } from "@/lib/api-client";
import { toast } from "sonner";
import { AlertOctagon, RefreshCw, Send } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReportError = async () => {
    if (!this.state.error) return;
    try {
      toast.loading("Sending report to support team...", { id: "error-report" });
      await apiFetch("/support/report-error", {
        method: "POST",
        body: JSON.stringify({
          errorName: this.state.error.name,
          errorMessage: this.state.error.message,
          errorStack: this.state.error.stack,
          context: {
            url: window.location.href,
            userAgent: navigator.userAgent,
          },
        }),
      });
      toast.dismiss("error-report");
      toast.success("Error details sent to margallagateaway.com support queue!");
    } catch (err: any) {
      toast.dismiss("error-report");
      toast.error(err.message || "Failed to submit error report");
    }
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-6 font-sans">
          <div className="bg-[#0b0f19] border border-red-500/30 rounded-2xl p-8 max-w-xl w-full shadow-2xl flex flex-col space-y-6 transform translate-y-0 scale-100 hover:-translate-y-1 hover:shadow-red-500/10 transition-all duration-300">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
                <AlertOctagon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-wide text-red-400 font-display">System Error Detected</h1>
                <p className="text-xs text-slate-400 mt-0.5 font-sans">The application encountered a critical runtime error.</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2 max-h-48 overflow-y-auto select-text text-red-300">
              <div className="font-bold text-red-400">{this.state.error.name}: {this.state.error.message}</div>
              <pre className="text-[10px] text-slate-500 leading-relaxed font-mono whitespace-pre-wrap">{this.state.error.stack}</pre>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                className="bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center justify-center gap-1.5"
                onClick={this.handleReportError}
              >
                <Send className="h-4 w-4" /> Report Error to Support
              </Button>
              <Button
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" /> Restart App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Button({ className, onClick, children, disabled }: { className?: string; onClick?: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-5 py-3 rounded-lg text-sm transition-all active:scale-95 shadow-md flex items-center justify-center ${className}`}
    >
      {children}
    </button>
  );
}
