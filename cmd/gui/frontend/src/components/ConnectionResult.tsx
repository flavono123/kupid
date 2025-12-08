import { useEffect, useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowLeft } from "lucide-react";
import { ConnectToContexts } from "../../wailsjs/go/main/App";
import { main } from "../../wailsjs/go/models";

interface ConnectionResultProps {
  contexts: string[];
  onBack: () => void;
}

export function ConnectionResult({ contexts, onBack }: ConnectionResultProps) {
  const [results, setResults] = useState<main.ContextConnectionResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const connectToContexts = async () => {
      setLoading(true);

      try {
        const connectionResults = await ConnectToContexts(contexts);
        setResults(connectionResults);
      } catch (error) {
        console.error("Failed to connect to contexts:", error);
        // Create error results for all contexts
        const errorResults: main.ContextConnectionResult[] = contexts.map((context) => ({
          context,
          success: false,
          error: "Failed to initiate connection",
        }));
        setResults(errorResults);
      } finally {
        setLoading(false);
      }
    };

    connectToContexts();
  }, [contexts]);

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  return (
    <div className="h-screen bg-background flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full px-8 py-12">
        {/* Header */}
        <div className="flex-shrink-0 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Contexts
          </Button>

          <h1 className="text-3xl text-foreground mb-2">
            Connection Results
          </h1>
          {!loading && (
            <p className="text-lg text-muted-foreground">
              {successCount === totalCount ? (
                <span className="text-green-600 font-medium">
                  All {totalCount} contexts connected successfully
                </span>
              ) : (
                <span>
                  <span className="text-green-600 font-medium">{successCount}</span>
                  {" / "}
                  <span className="font-medium">{totalCount}</span>
                  {" contexts connected"}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">
                Connecting to {contexts.length} context{contexts.length > 1 ? "s" : ""}...
              </p>
            </div>
          ) : (
            results.map((result) => (
              <Card
                key={result.context}
                className={`p-4 border-l-4 ${
                  result.success
                    ? "border-l-green-500 bg-green-50/50 dark:bg-green-950/20"
                    : "border-l-red-500 bg-red-50/50 dark:bg-red-950/20"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    {result.success ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg mb-1">
                      {result.context}
                    </h3>
                    {result.success ? (
                      <p className="text-sm text-muted-foreground">
                        Successfully connected to cluster
                      </p>
                    ) : (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {result.error || "Connection failed"}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Action Button */}
        {!loading && (
          <div className="flex-shrink-0 mt-8 flex justify-center">
            {successCount > 0 ? (
              <Button size="lg" onClick={() => console.log("Continue to main view")}>
                Continue →
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={onBack}>
                Try Again
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
